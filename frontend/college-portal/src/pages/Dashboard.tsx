import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, MapPin, Navigation, Settings, User, Bell } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase'; // Import Firestore instance
import { getBuses, getRoutes, validateSlug } from '../services/api';
import { getStreetName } from '../services/geocoding';
import Layout from '../components/Layout';
import MapComponent from '../components/MapComponent';

const isLiveBus = (bus: any) => {
    if (bus.status !== 'ON_ROUTE') return false;
    // Strict check: Must have active activeTripId
    if (!bus.activeTripId) return false;
    if (!bus.lastLocationUpdate) return false;
    try {
        const lastUpdate = bus.lastLocationUpdate.toDate ? bus.lastLocationUpdate.toDate() : new Date(bus.lastLocationUpdate);
        const diffMinutes = (new Date().getTime() - lastUpdate.getTime()) / 60000;
        return diffMinutes < 2; // Strict 2 minute limit for "LIVE" badge
    } catch (e) { return false; }
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

    // Initial Data Fetch & Validation
    useEffect(() => {
        const fetchInitialData = async () => {
            // 1. Verify User & Org
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
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

        // Listen for real-time updates to 'buses' collection
        const qBuses = query(collection(db, 'buses'), where('collegeId', '==', currentCollegeId));
        const unsubscribeBuses = onSnapshot(qBuses, (snapshot) => {
            const updatedBuses = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));
            setBuses(updatedBuses);
        });

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
            unsubscribeBuses();
            unsubscribeRoutes();
            unsubscribeNotifications();
        };

        return () => {
            console.log('Cleaning up real-time subscriptions for college:', currentCollegeId);
            unsubscribeBuses();
            unsubscribeRoutes();
        };
    }, [currentCollegeId]); // Depend on currentCollegeId state

    // Resolve addresses for active buses
    useEffect(() => {
        const resolveAddresses = async () => {
            const newAddresses: { [key: string]: string } = {};
            for (const bus of buses) {
                if (bus.status === 'ON_ROUTE' && bus.location?.latitude && bus.location?.longitude) {
                    // Only fetch if we don't have it or it moved significantly (optional optimization, but simple call is fine due to caching)
                    const address = await getStreetName(bus.location.latitude, bus.location.longitude);
                    newAddresses[bus._id] = address;
                }
            }
            if (Object.keys(newAddresses).length > 0) {
                setBusAddresses(prev => ({ ...prev, ...newAddresses }));
            }
        };
        resolveAddresses();
    }, [buses]);

    const handleBusClick = (bus: any) => {
        if (bus.location?.latitude && bus.location?.longitude) {
            setFocusedBusLocation({ lat: bus.location.latitude, lng: bus.location.longitude });
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
            <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">


                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Notification Banner (Phase 4.4) */}
                        {notifications.length > 0 && (
                            <div className="col-span-full bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <Bell className="text-blue-600 shrink-0 mt-0.5" size={20} />
                                <div className="flex-1">
                                    <h4 className="font-bold text-blue-800">Recent Alerts</h4>
                                    <div className="space-y-1 mt-1">
                                        {notifications.map(note => (
                                            <p key={note._id} className="text-sm text-blue-700">
                                                {note.message} <span className="text-xs text-blue-500 opacity-70">({getRelativeTime(note.createdAt?.toDate ? note.createdAt.toDate().toISOString() : new Date().toISOString())})</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <StatCard
                            title="Total Routes"
                            value={routes.length.toString()}
                            total={routes.length.toString()}
                            icon={<MapPin className="text-purple-600" size={24} />}
                            color="bg-purple-50"
                        />
                        <StatCard
                            title="Active Buses"
                            value={buses.filter(b => b.status === 'ACTIVE').length.toString()}
                            total={buses.length.toString()}
                            icon={<Bus className="text-blue-600" size={24} />}
                            color="bg-blue-50"
                        />
                        <StatCard
                            title="On Route"
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



                    {/* Map Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[500px] flex flex-col">
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
                        <MapComponent buses={buses.map(b => {
                            // Apply strict staleness check logic to status for visualization
                            if (isLiveBus(b)) return b; // It is truly active

                            // If it claims to be ON_ROUTE but fails strict check, downgrade it for map
                            if (b.status === 'ON_ROUTE') {
                                return { ...b, status: 'Active (Offline)' };
                            }
                            return b;
                        })} focusedLocation={focusedBusLocation} />
                    </div>

                    {/* Bus List */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Bus Status</h2>
                            <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </Layout >
    );
};

const StatCard = ({ title, value, total, icon, color }: any) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between">
        <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
                <span className="text-sm text-slate-400 font-medium">/ {total}</span>
            </div>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
            {icon}
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
            {bus.status === 'ON_ROUTE' && bus.location?.latitude ? (
                <div className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded-lg">
                    <Navigation size={14} className="text-green-500" />
                    <div className="flex-1">
                        <span className="font-semibold text-green-700">{bus.speed || 0} km/h</span>
                        <div className="text-green-600 ml-2 text-xs font-medium truncate max-w-[200px]" title={address}>
                            {address || `${bus.location.latitude.toFixed(4)}, ${bus.location.longitude.toFixed(4)}`}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{bus.location?.latitude ? 'Parked' : 'No GPS Data'}</span>
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
