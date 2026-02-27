import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, MapPin, Navigation, Settings, User, Bell } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase'; // Import Firestore instance
import { validateSlug, getBuses, getRoutes } from '../services/api';
import { getStreetName } from '../services/geocoding';
import Layout from '../components/Layout';
import MapLibreMap, { getBusLatLng } from '../components/MapLibreMap';
import { motion } from 'framer-motion';
import { DashboardSkeleton } from '../components/Skeleton';

const getBusLastUpdateIso = (bus: any): string | null => {
    if (bus.lastLocationUpdate) {
        try {
            if (typeof bus.lastLocationUpdate.toDate === 'function') {
                return bus.lastLocationUpdate.toDate().toISOString();
            }
            if (typeof bus.lastLocationUpdate === 'string') return bus.lastLocationUpdate;
            if (bus.lastLocationUpdate.seconds) {
                return new Date(bus.lastLocationUpdate.seconds * 1000).toISOString();
            }
        } catch (e) { /* fall through */ }
    }
    return bus.lastUpdated ?? null;
};

const isLiveBus = (bus: any) => {
    // If the bus has an active trip ID, it's live (relay is handling movement)
    if (!bus.activeTripId) return false;

    // Canonical: bus.status === 'ON_ROUTE'
    const isCanonicalLive = bus.status === 'ON_ROUTE';
    const isLegacyLive = bus.status === 'ACTIVE' || bus.status === 'LIVE';
    if (!(isCanonicalLive || isLegacyLive)) return false;

    const lastUpdateIso = getBusLastUpdateIso(bus);
    if (lastUpdateIso) {
        try {
            const lastUpdate = new Date(lastUpdateIso);
            const diffMinutes = (new Date().getTime() - lastUpdate.getTime()) / 60000;
            return diffMinutes < 30; // 30 mins instead of 5
        } catch (e) { return true; }
    }

    return true;
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

        // Real-time listener for buses (Replaces 30s polling)
        const qBuses = query(collection(db, 'buses'), where('collegeId', '==', currentCollegeId));
        const unsubscribeBuses = onSnapshot(qBuses, (snapshot) => {
            const updatedBuses = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));
            setBuses(updatedBuses);
        }, (err) => {
            console.error('[Dashboard] Buses snapshot listener failed:', err);
        });

        // Listen for real-time updates to 'routes' collection
        const qRoutes = query(collection(db, 'routes'), where('collegeId', '==', currentCollegeId));
        const unsubscribeRoutes = onSnapshot(qRoutes, (snapshot) => {
            const updatedRoutes = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));
            setRoutes(updatedRoutes);
        }, (err) => {
            console.error('[Dashboard] Routes snapshot listener failed:', err);
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
        }, (err) => {
            console.error('[Dashboard] Notifications snapshot listener failed (likely needs composite index):', err);
        });

        return () => {
            console.log('Cleaning up real-time subscriptions for college:', currentCollegeId);
            unsubscribeBuses();
            unsubscribeRoutes();
            unsubscribeNotifications();
        };

    }, [currentCollegeId]); // Depend on currentCollegeId state



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
            <Layout activeItem="dashboard">
                <DashboardSkeleton />
            </Layout>
        );
    }

    return (
        <Layout activeItem="dashboard">
            <div className="p-4 md:p-6 lg:p-8 min-h-full">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-[1600px] mx-auto space-y-4 md:space-y-6"
                >


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
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="lg:col-span-8 bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden h-[380px] md:h-[420px] lg:h-[450px] flex flex-col"
                        >
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50 rounded-lg">
                                        <MapPin size={18} className="text-blue-600" />
                                    </div>
                                    Live Fleet Tracking
                                </h3>
                                <div className="flex items-center gap-2">
                                    {buses.some(isLiveBus) && (
                                        <div className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full flex items-center gap-1.5 border border-green-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            REAL-TIME
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
                        </motion.div>

                        {/* Recent Alerts / Quick Notifications */}
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="lg:col-span-4 flex flex-col space-y-4"
                        >
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 flex-1 overflow-y-auto max-h-[450px]">
                                <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-50">
                                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
                                        <Bell size={14} className="text-blue-600" />
                                        System Alerts
                                    </h3>
                                    <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">LIVE Updates</span>
                                </div>
                                <div className="space-y-4">
                                    {notifications.length > 0 ? (
                                        notifications.map((note, idx) => (
                                            <motion.div 
                                                key={note._id} 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.4 + (idx * 0.1) }}
                                                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-blue-200 hover:bg-white hover:shadow-md transition-all cursor-default text-[13px]"
                                            >
                                                <p className="text-slate-800 leading-relaxed font-medium mb-2">{note.message}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        {getRelativeTime(note.createdAt?.toDate ? note.createdAt.toDate().toISOString() : new Date().toISOString())}
                                                    </span>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="py-16 text-center opacity-30">
                                            <Bell className="mx-auto mb-3 text-slate-300" size={32} />
                                            <p className="text-[11px] font-bold uppercase tracking-widest">Quiet for now</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
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
                </motion.div>
            </div>
        </Layout>
    );
};

const StatCard = ({ title, value, total, icon, color }: any) => (
    <motion.div 
        whileHover={{ y: -4, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.1)' }}
        className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 flex items-center justify-between group transition-all"
    >
        <div className="flex items-center gap-5">
            <div className={`p-4 rounded-2xl ${color} group-hover:scale-110 transition-transform duration-500`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-900 leading-none tracking-tight">{value}</h3>
                    <span className="text-[11px] text-slate-400 font-bold">/ {total}</span>
                </div>
            </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
        </div>
    </motion.div>
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

const isStale = (isoString: string, thresholdSeconds = 120) => {
    if (!isoString) return true;
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return true;
        const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        return diffInSeconds > thresholdSeconds;
    } catch (e) { return true; }
};

const BusCard = ({ bus, address }: { bus: any, address?: string }) => {
    const lastUpdateIso = getBusLastUpdateIso(bus);
    const stale = isStale(lastUpdateIso ?? '', 120);
    const speedMph = Math.round(bus.speedMph ?? bus.currentSpeed ?? bus.speed ?? bus.speedMPH ?? 0);

    return (
        <motion.div 
            whileHover={{ y: -4, boxShadow: '0 20px 40px -20px rgba(0,0,0,0.1)' }}
            className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-200 transition-all group relative overflow-hidden"
        >
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs tracking-tighter shadow-sm border ${
                        bus.status === 'ON_ROUTE' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                        {bus.busNumber?.slice(-2) || '00'}
                    </div>
                    <div>
                        <h4 className="font-extrabold text-slate-900 tracking-tight">{bus.busNumber}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                            <User size={10} className="text-slate-400" />
                            {bus.driverName || 'Unassigned'}
                        </p>
                    </div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-[0.05em] uppercase border ${
                    isLiveBus(bus) ? 'bg-green-50 text-green-700 border-green-200' :
                    bus.status === 'ACTIVE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    bus.status === 'MAINTENANCE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                    {isLiveBus(bus) ? (
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            TRACKING
                        </span>
                    ) : bus.status || 'OFFLINE'}
                </div>
            </div>
            
            <div className="space-y-3 relative z-10">
                {bus.status === 'ON_ROUTE' && getBusLatLng(bus) ? (
                    <div className="flex flex-col gap-2.5 bg-slate-50/50 p-3 rounded-[20px] border border-slate-100/50">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Velocity</span>
                            <span className={`text-sm font-black ${stale ? 'text-slate-300' : 'text-slate-900'}`}>
                                {stale ? '00' : speedMph} <span className="text-[10px] font-bold text-slate-400">MPH</span>
                            </span>
                        </div>
                        <div className="flex items-start gap-2 px-1">
                            <MapPin size={12} className="text-blue-500 mt-0.5 shrink-0" />
                            <div className="text-[11px] text-slate-600 font-medium leading-tight line-clamp-2" title={address}>
                                {address || `${getBusLatLng(bus)![1].toFixed(4)}, ${getBusLatLng(bus)![0].toFixed(4)}`}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 p-3 rounded-[20px] bg-slate-50 border border-slate-100/50 text-slate-400">
                        <MapPin size={12} className="shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-widest">{getBusLatLng(bus) ? 'Stationary' : 'Signal Lost'}</span>
                    </div>
                )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between relative z-10">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${stale ? 'bg-slate-200' : 'bg-green-400'}`}></div>
                    Sync: {getRelativeTime(lastUpdateIso ?? '')}
                </span>
                
                <button className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest p-1 -mr-1 transition-colors">
                    Details →
                </button>
            </div>

            {/* Subtle background flair */}
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </motion.div>
    );
};

export default Dashboard;
