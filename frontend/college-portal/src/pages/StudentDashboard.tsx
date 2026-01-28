import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bus, LogOut, User, MapPin, Navigation, RotateCw } from 'lucide-react';
import { validateSlug, getStudentBuses } from '../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import MapComponent from '../components/MapComponent';

const StudentDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [college, setCollege] = useState<any>(null);
    const [buses, setBuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [focusedBusLocation, setFocusedBusLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const collegeId = localStorage.getItem('current_college_id');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate(`/${orgSlug}/student/login`);
            return;
        }

        const loadCollege = async () => {
            try {
                const data = await validateSlug(orgSlug || '');
                setCollege(data);
                localStorage.setItem('current_college_id', data.collegeId);
            } catch (err) {
                console.error(err);
            }
        };
        loadCollege();
    }, [orgSlug, navigate]);

    // Initial data fetch
    useEffect(() => {
        const fetchBuses = async () => {
            try {
                const response = await getStudentBuses();
                const busData = Array.isArray(response) ? response : response.data || [];
                setBuses(busData);
            } catch (err) {
                console.error('Failed to fetch buses:', err);
            } finally {
                setLoading(false);
            }
        };
        if (collegeId) fetchBuses();
    }, [collegeId]);

    // Real-time bus updates
    useEffect(() => {
        if (!collegeId) return;

        const qBuses = query(collection(db, 'buses'), where('collegeId', '==', collegeId));
        const unsubscribe = onSnapshot(qBuses, (snapshot) => {
            const updatedBuses = snapshot.docs.map(doc => ({
                _id: doc.id,
                ...doc.data()
            }));
            setBuses(updatedBuses);
        });

        return () => unsubscribe();
    }, [collegeId]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('current_college_id');
        navigate(`/${orgSlug}/login`);
    };

    const handleBusClick = (bus: any) => {
        // Only focus if the bus is ON_ROUTE and has valid location
        if (bus.status === 'ON_ROUTE' && bus.location?.latitude && bus.location?.longitude) {
            setFocusedBusLocation({ lat: bus.location.latitude, lng: bus.location.longitude });
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const response = await getStudentBuses();
            const busData = Array.isArray(response) ? response : response.data || [];
            setBuses(busData);
        } catch (err) {
            console.error('Refresh failed:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const activeBuses = buses.filter(b => b.status === 'ON_ROUTE');

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                                <Bus size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-lg tracking-tight">Student Portal</h1>
                                <p className="text-xs text-slate-400 font-medium">{college?.collegeName}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
                        >
                            <LogOut size={16} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 border border-white/10 shadow-2xl"
                >
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px]" />
                    <div className="relative z-10 p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 p-[2px] shadow-xl">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl font-bold text-blue-400">
                                {user?.name?.charAt(0) || <User size={40} />}
                            </div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-white mb-2">Hello, {user?.name?.split(' ')[0]}!</h2>
                            <div className="flex flex-wrap gap-4 text-sm text-blue-200/80">
                                <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">{user?.email}</span>
                                <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">Reg No: {user?.registerNumber || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Live Map Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-800/50 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-[400px] flex flex-col"
                >
                    <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <MapPin size={20} className="text-blue-400" />
                            Live Bus Tracking
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRefresh}
                                className={`p-1.5 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all ${refreshing ? 'animate-spin text-blue-400' : ''}`}
                                title="Refresh"
                                disabled={refreshing}
                            >
                                <RotateCw size={18} />
                            </button>
                            {activeBuses.length > 0 && (
                                <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    {activeBuses.length} LIVE
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 relative">
                        <MapComponent buses={buses} focusedLocation={focusedBusLocation} />
                    </div>
                </motion.div>

                {/* Bus List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">College Buses</h3>
                        <span className="text-sm text-slate-400">{buses.length} buses</span>
                    </div>
                    {loading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-slate-800/50 rounded-2xl p-5 border border-white/5 animate-pulse">
                                    <div className="h-5 bg-slate-700 rounded w-1/2 mb-3"></div>
                                    <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
                                </div>
                            ))}
                        </div>
                    ) : buses.length === 0 ? (
                        <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-dashed border-white/10">
                            <Bus size={48} className="mx-auto text-slate-600 mb-3" />
                            <p className="text-slate-400">No buses available yet.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {buses.map((bus) => (
                                <motion.div
                                    key={bus._id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleBusClick(bus)}
                                    className={`bg-slate-800/50 backdrop-blur-md border rounded-2xl p-5 cursor-pointer transition-all ${bus.status === 'ON_ROUTE'
                                        ? 'border-green-500/30 hover:border-green-500/50'
                                        : 'border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${bus.status === 'ON_ROUTE' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                <Bus size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white">{bus.busNumber}</h4>
                                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                                    <User size={10} />
                                                    {bus.driverName || 'Unassigned'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${bus.status === 'ON_ROUTE' ? 'bg-green-500/20 text-green-400 animate-pulse' :
                                            bus.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {bus.status === 'ON_ROUTE' ? 'LIVE' : bus.status || 'Unknown'}
                                        </span>
                                    </div>
                                    {bus.status === 'ON_ROUTE' && bus.location?.latitude && (
                                        <div className="flex items-center gap-2 text-sm bg-green-500/10 p-2 rounded-lg">
                                            <Navigation size={14} className="text-green-400" />
                                            <span className="text-green-300 font-semibold">{bus.speed || 0} km/h</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
};

export default StudentDashboard;
