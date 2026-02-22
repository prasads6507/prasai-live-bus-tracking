import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, MapPin, Navigation, Settings, User, Bell } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase'; // Import Firestore instance
import { validateSlug, getBuses, getRoutes, getRelayToken } from '../services/api';
import { RelayService } from '../services/relay';
import { getStreetName } from '../services/geocoding';
import Layout from '../components/Layout';
import MapLibreMap, { getBusLatLng } from '../components/MapLibreMap';

const isLiveBus = (bus: any) => {
    // If the bus has an active trip ID, it's live (relay is handling movement)
    if (!bus.activeTripId) return false;

    // Status can be ON_ROUTE (set by backend start) or ACTIVE (legacy/alternate)
    const isActive = bus.status === 'ON_ROUTE' || bus.status === 'ACTIVE';
    if (!isActive) return false;

    // Use a much longer heartbeat for "Offline" fallback, since we rely on WebSockets now
    if (bus.lastUpdated || bus.lastLocationUpdate) {
        try {
            const dateStr = bus.lastUpdated || (bus.lastLocationUpdate.toDate ? bus.lastLocationUpdate.toDate().toISOString() : bus.lastLocationUpdate);
            const lastUpdate = new Date(dateStr);
            const diffMinutes = (new Date().getTime() - lastUpdate.getTime()) / 60000;
            return diffMinutes < 30; // 30 mins instead of 5
        } catch (e) { return true; } // If parse fails but we have tripId, assume live
    }

    return true; // We have activeTripId, so it's live
};

const Dashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [buses, setBuses] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentCollegeId, setCurrentCollegeId] = useState<string | null>(localStorage.getItem('current_college_id'));
    const [focusedBusLocation, setFocusedBusLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [busAddresses, setBusAddresses] = useState<{ [key: string]: string }>({});
    const [notifications, setNotifications] = useState<any[]>([]);
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [followSelectedBus, setFollowSelectedBus] = useState(true);

    // Initial Data Fetch & Validation
    useEffect(() => {
        const fetchInitialData = async () => {
            // 1. Verify User & Org
            const storedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            if (!storedUser || !token) {
                navigate(`/${orgSlug}/login`);
                return;
            }

            try {
                // 2. Fetch Org Details if name not set (optional optimization)
                if (orgSlug) {
                    const orgData = await validateSlug(orgSlug);
                    // Ensure context is set for API calls (important for Super Admin)
                    localStorage.setItem('current_college_id', orgData.collegeId);
                    setCurrentCollegeId(orgData.collegeId);
                }

                // 3. Fetch Data in Parallel
                const [busData, routeData] = await Promise.all([
                    getBuses(),
                    getRoutes()
                ]);

                // Ensure data arrays
                setBuses(Array.isArray(busData) ? busData : busData.data || []);
                setRoutes(Array.isArray(routeData) ? routeData : routeData.data || []);

            } catch (err) {
                console.error("Dashboard Fetch Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [orgSlug, navigate]);

    // Real-time Bus Updates
    useEffect(() => {
        if (!currentCollegeId) {
            console.warn('No college ID found for real-time subscription');
            return;
        }

        console.log('Setting up real-time bus subscription for college:', currentCollegeId);

        // Periodic bus list refresh (every 30s)
        const refreshBuses = async () => {
            try {
                const response = await getBuses();
                setBuses(Array.isArray(response) ? response : response.data || []);
            } catch (err) {
                console.error('Failed to refresh buses:', err);
            }
        };

        const busInterval = setInterval(refreshBuses, 30000);

        // Listen for real-time updates to 'routes' collection
        const qRoutes = query(collection(db, 'routes'), where('collegeId', '==', currentCollegeId));
        const unsubscribeRoutes = onSnapshot(qRoutes, (snapshot) => {
            const updatedRoutes = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));
            setRoutes(updatedRoutes);
        });

        // Listen for real-time notifications (Phase 4.4)
        const qNotifications = query(
            collection(db, 'notifications'),
            where('collegeId', '==', currentCollegeId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
            const notes = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));
            setNotifications(notes);
        });

        return () => {
            console.log('Cleaning up real-time subscriptions for college:', currentCollegeId);
            clearInterval(busInterval);
            unsubscribeRoutes();
            unsubscribeNotifications();
        };
    }, [currentCollegeId]); // Depend on currentCollegeId state

    // ── Stable relay connection manager ─────────────────────────────────────
    // Keeps one WebSocket open per live bus for the entire trip session.
    // Does NOT reconnect when bus location/speed updates (would cause a loop).
    const relaysRef = useRef<Map<string, RelayService>>(new Map());
    const connectedBusIdsRef = useRef<Set<string>>(new Set());

    // Only recompute when a bus becomes live or stops being live — NOT on location changes.
    const liveBusIds = useMemo(
        () => new Set(buses.filter(isLiveBus).map(b => b._id as string)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [buses.map(b => `${b._id}:${b.activeTripId ?? ''}:${b.status ?? ''}`).join('|')]
    );

    useEffect(() => {
        const currentLiveIds = liveBusIds;
        const connected = connectedBusIdsRef.current;

        // Connect newly-live buses
        const toConnect = [...currentLiveIds].filter(id => !connected.has(id));
        for (const busId of toConnect) {
            const relay = new RelayService();
            relaysRef.current.set(busId, relay);
            connected.add(busId);

            // Capture stable refs for use inside the async callback
            const stableBusId = busId;

            (async () => {
                try {
                    const tokenResp = await getRelayToken(stableBusId, 'admin');
                    relay.connect(tokenResp.wsUrl, {
                        onMessage: (data: any) => {
                            if (data.type === 'bus_location_update') {
                                const lat = data.lat ?? data.latitude;
                                const lng = data.lng ?? data.longitude;
                                const speedMph = Math.max(0, data.speedMph ?? data.speed ?? 0);
                                const heading = data.heading ?? 0;

                                // Update this bus's location in state — does NOT trigger relay effect re-run
                                setBuses(prev => prev.map(b => {
                                    if (b._id === stableBusId) {
                                        return {
                                            ...b,
                                            location: { latitude: lat, longitude: lng, heading },
                                            speed: speedMph,
                                            lastUpdated: new Date().toISOString()
                                        };
                                    }
                                    return b;
                                }));

                                // Pan map to selected bus if follow mode is on
                                if (followSelectedBus && selectedBusId === stableBusId) {
                                    setFocusedBusLocation({ lat, lng });
                                }
                            }
                        },
                        onOpen: () => console.log('[Admin] WS connected for bus', stableBusId),
                        onClose: () => console.log('[Admin] WS disconnected for bus', stableBusId),
                    });
                } catch (err) {
                    console.error('[Admin] Failed to connect relay for bus', stableBusId, err);
                    // Remove from connected set so next effect run can retry
                    connected.delete(stableBusId);
                    relaysRef.current.delete(stableBusId);
                }
            })();
        }

        // Disconnect buses that are no longer live
        const toDisconnect = [...connected].filter(id => !currentLiveIds.has(id));
        for (const busId of toDisconnect) {
            relaysRef.current.get(busId)?.disconnect();
            relaysRef.current.delete(busId);
            connected.delete(busId);
        }

        // Cleanup on unmount: disconnect everything
        return () => {
            relaysRef.current.forEach(r => r.disconnect());
            relaysRef.current.clear();
            connectedBusIdsRef.current.clear();
        };
    }, [liveBusIds, selectedBusId, followSelectedBus]);

    // Resolve addresses for active buses - Smart bulk update
    useEffect(() => {
        const resolveAddresses = async () => {
            const newAddresses: { [key: string]: string } = {};
            let hasUpdates = false;

            for (const bus of buses) {
                const latLng = getBusLatLng(bus);
                if (!latLng) continue;

                // Only resolve if it's the selected bus OR we don't have an address for it yet
                // This prevents spamming the geocoder while ensuring every card has an initial address
                if (bus._id === selectedBusId || !busAddresses[bus._id]) {
                    const address = await getStreetName(latLng[1], latLng[0]);
                    if (address && busAddresses[bus._id] !== address) {
                        newAddresses[bus._id] = address;
                        hasUpdates = true;
                    }
                }
            }

            if (hasUpdates) {
                setBusAddresses(prev => ({ ...prev, ...newAddresses }));
            }
        };

        const timeout = setTimeout(resolveAddresses, 1000);
        return () => clearTimeout(timeout);
    }, [buses, selectedBusId]);

    const handleBusClick = (bus: any) => {
        setSelectedBusId(bus._id);
        setFollowSelectedBus(true);
        const latLng = getBusLatLng(bus);
        if (latLng) {
            setFocusedBusLocation({ lat: latLng[1], lng: latLng[0] });
            // Scroll to map
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };



    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <Layout activeItem="dashboard">
            <div className="p-4 md:p-6 lg:p-8 bg-slate-50/50 min-h-full">
                <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">


                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">


                        <StatCard
                            title="Total Routes"
                            value={routes.length.toString()}
                            total={routes.length.toString()}
                            icon={<MapPin className="text-purple-600" size={24} />}
                            color="bg-purple-50"
                        />
                        <StatCard
                            title="Buses"
                            value={buses.length.toString()}
                            total={buses.length.toString()}
                            icon={<Bus className="text-blue-600" size={24} />}
                            color="bg-blue-50"
                        />
                        <StatCard
                            title="On Road (Live)"
                            value={buses.filter(isLiveBus).length.toString()}
                            total={buses.length.toString()}
                            icon={<Navigation className="text-green-600" size={24} />}
                            color="bg-green-50"
                        />
                        <StatCard
                            title="Maintenance"
                            value={buses.filter(b => b.status === 'MAINTENANCE').length.toString()}
                            total={buses.length.toString()}
                            icon={<Settings className="text-orange-600" size={24} />}
                            color="bg-orange-50"
                        />
                    </div>



                    {/* Main Content Area: Map & Alerts Side-by-Side on Desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Map Section */}
                        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[380px] md:h-[420px] lg:h-[450px] flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <MapPin size={20} className="text-blue-600" />
                                    Live Fleet Tracking
                                </h3>
                                <div className="flex items-center gap-2">
                                    {buses.some(isLiveBus) && (
                                        <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                            LIVE
                                        </div>
                                    )}
                                </div>
                            </div>
                            <MapLibreMap
                                buses={buses.map(b => {
                                    if (isLiveBus(b)) return b;
                                    if (b.status === 'ON_ROUTE') return { ...b, status: 'Active (Offline)' };
                                    return b;
                                })}
                                focusedLocation={focusedBusLocation}
                                selectedBusId={selectedBusId}
                                followBus={followSelectedBus}
                                onBusClick={(id) => setSelectedBusId(id)}
                            />
                        </div>

                        {/* Recent Alerts / Quick Notifications */}
                        <div className="lg:col-span-4 flex flex-col space-y-4">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex-1 overflow-y-auto max-h-[450px]">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <Bell size={16} className="text-blue-600" />
                                        Live Alerts
                                    </h3>
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">LIVE</span>
                                </div>
                                <div className="space-y-3">
                                    {notifications.length > 0 ? (
                                        notifications.map(note => (
                                            <div key={note._id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-default text-[13px]">
                                                <p className="text-slate-700 leading-snug mb-1">{note.message}</p>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {getRelativeTime(note.createdAt?.toDate ? note.createdAt.toDate().toISOString() : new Date().toISOString())}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center opacity-40">
                                            <Bell className="mx-auto mb-2 text-slate-300" size={24} />
                                            <p className="text-xs">No recent alerts</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bus List - Optimized Grid */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Bus size={20} className="text-blue-600" />
                                Fleet Monitor
                            </h2>
                            <button className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow-md">
                                VIEW DETAILED FLEET
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {buses.length > 0 ? (
                                buses.map((bus) => (
                                    <div key={bus._id} onClick={() => handleBusClick(bus)} className="cursor-pointer">
                                        <BusCard bus={bus} address={busAddresses[bus._id]} />
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                                    <Bus className="mx-auto text-slate-300 mb-3" size={48} />
                                    <p className="text-slate-500 font-medium">No buses found in the fleet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

const StatCard = ({ title, value, total, icon, color }: any) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between group hover:shadow-md transition-all">
        <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${color} group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
                <div className="flex items-baseline gap-1.5">
                    <h3 className="text-xl font-black text-slate-800 leading-none">{value}</h3>
                    <span className="text-[10px] text-slate-400 font-bold">/ {total}</span>
                </div>
            </div>
        </div>
    </div>
);

// Helper for relative time
const getRelativeTime = (isoString: string) => {
    if (!isoString) return 'Offline';
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return date.toLocaleDateString();
};

const BusCard = ({ bus, address }: { bus: any, address?: string }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${bus.status === 'ON_ROUTE' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                    {bus.busNumber?.slice(0, 2) || 'BS'}
                </div>
                <div>
                    <h4 className="font-bold text-slate-800">{bus.busNumber}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <User size={10} />
                        {bus.driverName || 'Unassigned'}
                    </p>
                </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLiveBus(bus) ? 'bg-green-100 text-green-700 animate-pulse' :
                bus.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                    bus.status === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                }`}>
                {isLiveBus(bus) ? 'LIVE' : bus.status || 'Unknown'}
            </span>
        </div>
        <div className="space-y-2">
            {bus.status === 'ON_ROUTE' && getBusLatLng(bus) ? (
                <div className="flex flex-col gap-2 text-sm bg-green-50 p-2 rounded-lg">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">Speed</span>
                        <span className="font-semibold text-green-700">{Math.round(bus.speed || 0)} mph</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-green-500" />
                        <div className="text-green-600 text-xs font-medium truncate max-w-[200px]" title={address}>
                            {address || `${getBusLatLng(bus)![1].toFixed(4)}, ${getBusLatLng(bus)![0].toFixed(4)}`}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{getBusLatLng(bus) ? 'Parked' : 'No GPS Data'}</span>
                </div>
            )}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
                Updated: {getRelativeTime(bus.lastUpdated)}
            </span>
            {isLiveBus(bus) && (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                    Tracking
                </span>
            )}
        </div>
    </div>
);

export default Dashboard;
