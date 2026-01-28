import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, LogOut, User, MapPin, RotateCw, Search, Star, X, Crosshair } from 'lucide-react';
import { validateSlug, getStudentBuses } from '../services/api';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import MapComponent from '../components/MapComponent';

// Reverse geocoding cache to avoid repeated API calls
const locationCache: { [key: string]: string } = {};

const getStreetName = async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (locationCache[cacheKey]) return locationCache[cacheKey];

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`
        );
        const data = await response.json();
        const address = data.address || {};
        const parts = [
            address.road || address.neighbourhood || address.suburb,
            address.city || address.town || address.village || address.county
        ].filter(Boolean);
        const result = parts.join(', ') || 'Unknown Location';
        locationCache[cacheKey] = result;
        return result;
    } catch {
        return 'Location unavailable';
    }
};

const StudentDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [college, setCollege] = useState<any>(null);
    const [buses, setBuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [focusedBusLocation, setFocusedBusLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBus, setSelectedBus] = useState<any>(null);
    const [busLocations, setBusLocations] = useState<{ [id: string]: string }>({});
    const [favorites, setFavorites] = useState<string[]>([]);

    const user = JSON.parse(localStorage.getItem('student_user') || '{}');
    const collegeId = localStorage.getItem('current_college_id');

    // Load favorites from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('favorite_buses');
        if (saved) setFavorites(JSON.parse(saved));
    }, []);

    // Save favorites to localStorage
    const toggleFavorite = (busId: string) => {
        setFavorites(prev => {
            const updated = prev.includes(busId)
                ? prev.filter(id => id !== busId)
                : [...prev, busId];
            localStorage.setItem('favorite_buses', JSON.stringify(updated));
            return updated;
        });
    };

    useEffect(() => {
        const token = localStorage.getItem('student_token');
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

    // Fetch street names for active buses
    useEffect(() => {
        buses.forEach(async (bus) => {
            if (bus.status === 'ON_ROUTE' && bus.location?.latitude && bus.location?.longitude) {
                const street = await getStreetName(bus.location.latitude, bus.location.longitude);
                setBusLocations(prev => ({ ...prev, [bus._id]: street }));
            }
        });
    }, [buses]);

    const handleLogout = () => {
        localStorage.removeItem('student_token');
        localStorage.removeItem('student_user');
        localStorage.removeItem('current_college_id');
        navigate(`/${orgSlug}/login`);
    };

    const handleTrackBus = (bus: any) => {
        if (bus.status === 'ON_ROUTE' && bus.location?.latitude && bus.location?.longitude) {
            setFocusedBusLocation({ lat: bus.location.latitude, lng: bus.location.longitude });
            setSelectedBus(null);
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

    // Filter buses by search
    const filteredBuses = useMemo(() => {
        if (!searchQuery.trim()) return buses;
        const q = searchQuery.toLowerCase();
        return buses.filter(bus =>
            bus.busNumber?.toLowerCase().includes(q) ||
            bus.numberPlate?.toLowerCase().includes(q) ||
            bus.driverName?.toLowerCase().includes(q)
        );
    }, [buses, searchQuery]);

    // Favorite buses
    const favoriteBuses = useMemo(() =>
        buses.filter(bus => favorites.includes(bus._id)),
        [buses, favorites]
    );

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
                            <h2 className="text-3xl font-bold text-white mb-2">Hello, {user?.name?.split(' ')[0] || 'Student'}!</h2>
                            <div className="flex flex-wrap gap-4 text-sm text-blue-200/80">
                                <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">{user?.email}</span>
                                <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">Reg No: {user?.registerNumber || user?.email?.split('@')[0] || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Favorites Section */}
                {favoriteBuses.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Star size={18} className="text-yellow-400 fill-yellow-400" />
                            <h3 className="text-lg font-bold text-white">Favorite Buses</h3>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {favoriteBuses.map(bus => (
                                <button
                                    key={bus._id}
                                    onClick={() => handleTrackBus(bus)}
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all ${bus.status === 'ON_ROUTE'
                                        ? 'bg-green-500/20 border-green-500/30 hover:border-green-500/50'
                                        : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Bus size={16} className={bus.status === 'ON_ROUTE' ? 'text-green-400' : 'text-slate-400'} />
                                        <span className="font-bold text-white">{bus.busNumber}</span>
                                        {bus.status === 'ON_ROUTE' && (
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

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

                {/* Search Bar */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <div className="relative">
                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by bus number, plate, or driver..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                        />
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
                        <span className="text-sm text-slate-400">{filteredBuses.length} buses</span>
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
                    ) : filteredBuses.length === 0 ? (
                        <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-dashed border-white/10">
                            <Bus size={48} className="mx-auto text-slate-600 mb-3" />
                            <p className="text-slate-400">{searchQuery ? 'No buses found matching your search.' : 'No buses available yet.'}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredBuses.map((bus) => (
                                <motion.div
                                    key={bus._id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedBus(bus)}
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
                                                <p className="text-xs text-slate-400">{bus.numberPlate || 'No Plate'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleFavorite(bus._id); }}
                                                className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                                            >
                                                <Star size={16} className={favorites.includes(bus._id) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'} />
                                            </button>
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${bus.status === 'ON_ROUTE' ? 'bg-green-500/20 text-green-400' :
                                                bus.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {bus.status === 'ON_ROUTE' ? 'LIVE' : bus.status || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <User size={14} />
                                            <span>{bus.driverName || 'Unassigned'}</span>
                                        </div>
                                        {bus.status === 'ON_ROUTE' && busLocations[bus._id] && (
                                            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 p-2 rounded-lg">
                                                <MapPin size={14} />
                                                <span className="text-sm truncate">{busLocations[bus._id]}</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </main>

            {/* Bus Details Modal */}
            <AnimatePresence>
                {selectedBus && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedBus(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-800 rounded-3xl p-6 max-w-md w-full border border-white/10 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedBus.status === 'ON_ROUTE' ? 'bg-green-500/20' : 'bg-blue-500/20'
                                        }`}>
                                        <Bus size={24} className={selectedBus.status === 'ON_ROUTE' ? 'text-green-400' : 'text-blue-400'} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{selectedBus.busNumber}</h3>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedBus.status === 'ON_ROUTE' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {selectedBus.status === 'ON_ROUTE' ? 'LIVE' : selectedBus.status}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedBus(null)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                                    <span className="text-slate-400">Number Plate</span>
                                    <span className="font-bold text-white">{selectedBus.numberPlate || 'Not Available'}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                                    <span className="text-slate-400">Driver</span>
                                    <span className="font-bold text-white">{selectedBus.driverName || 'Unassigned'}</span>
                                </div>
                                {selectedBus.status === 'ON_ROUTE' && busLocations[selectedBus._id] && (
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MapPin size={16} className="text-green-400" />
                                            <span className="text-sm text-green-400 font-medium">Current Location</span>
                                        </div>
                                        <p className="text-white font-semibold">{busLocations[selectedBus._id]}</p>
                                    </div>
                                )}
                                {selectedBus.speed != null && selectedBus.status === 'ON_ROUTE' && (
                                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                                        <span className="text-slate-400">Speed</span>
                                        <span className="font-bold text-white">{selectedBus.speed} km/h</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => toggleFavorite(selectedBus._id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${favorites.includes(selectedBus._id)
                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    <Star size={18} className={favorites.includes(selectedBus._id) ? 'fill-yellow-400' : ''} />
                                    {favorites.includes(selectedBus._id) ? 'Favorited' : 'Add to Favorites'}
                                </button>
                                {selectedBus.status === 'ON_ROUTE' && (
                                    <button
                                        onClick={() => handleTrackBus(selectedBus)}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-all"
                                    >
                                        <Crosshair size={18} />
                                        Track Bus
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StudentDashboard;
