import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, LogOut, User, MapPin, Search, Star, X, Crosshair, AlertCircle, ArrowLeft, Clock } from 'lucide-react';
import { validateSlug, getStudentBuses, getStudentRoutes, getRelayToken } from '../services/api';
import { getStreetName } from '../services/geocoding';
import { RelayService } from '../services/relay';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import MapLibreMapComponent from '../components/MapLibreMapComponent';
import useNotification from '../hooks/useNotification';

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

const StudentDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [college, setCollege] = useState<any>(null);
    const [buses, setBuses] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [focusedBusLocation, setFocusedBusLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBus, setSelectedBus] = useState<any>(null);
    const [assignedBus, setAssignedBus] = useState<any>(null);
    const [substituteBus, setSubstituteBus] = useState<any>(null);
    const [busLocations, setBusLocations] = useState<{ [id: string]: string }>({});
    const [favorites, setFavorites] = useState<string[]>([]);
    const [trackedBus, setTrackedBus] = useState<any>(null); // New state for tracking view


    const user = JSON.parse(localStorage.getItem('student_user') || '{}');
    const collegeId = localStorage.getItem('current_college_id');

    // Initialize notifications
    useNotification(user?._id);

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
                const fetchedBuses = busData;
                setBuses(fetchedBuses);

                const routeResp = await getStudentRoutes();
                setRoutes(Array.isArray(routeResp) ? routeResp : routeResp.data || []);

                // Check for assigned bus and substitute (Phase 5.3)
                if (user?.assignedBusId) {
                    const myBus = fetchedBuses.find((b: any) => b._id === user.assignedBusId);
                    if (myBus) {
                        setAssignedBus(myBus);

                        // Check for substitute (Phase 5.3)
                        if ((myBus as any).substituteBusId) {
                            const sub = fetchedBuses.find((b: any) => b._id === (myBus as any).substituteBusId);
                            setSubstituteBus(sub);
                        } else {
                            setSubstituteBus(null);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch buses:', err);
            } finally {
                setLoading(false);
            }
        };
        if (collegeId) fetchBuses();
    }, [collegeId, user?.assignedBusId]);

    // Periodic bus list refresh (every 30s instead of Firestore onSnapshot)
    useEffect(() => {
        if (!collegeId) return;

        const refreshBuses = async () => {
            try {
                const response = await getStudentBuses();
                const busData = Array.isArray(response) ? response : response.data || [];
                setBuses(busData);

                if (user?.assignedBusId) {
                    const myBus = busData.find((b: any) => b._id === user.assignedBusId);
                    if (myBus) {
                        setAssignedBus(myBus);
                        if ((myBus as any).substituteBusId) {
                            const sub = busData.find((b: any) => b._id === (myBus as any).substituteBusId);
                            setSubstituteBus(sub);
                        } else {
                            setSubstituteBus(null);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to refresh buses:', err);
            }
        };

        const interval = setInterval(refreshBuses, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [collegeId, user?.assignedBusId]);

    // 10-minute interval GPS tracking for student location (Battery efficient)
    useEffect(() => {
        if (!user?._id) return;

        const trackStudentLocation = () => {
            if (!navigator.geolocation) return;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const address = await getStreetName(latitude, longitude);

                        // Update student document with last known location
                        const studentRef = doc(db, 'students', user._id);
                        await updateDoc(studentRef, {
                            lastLocation: { latitude, longitude },
                            lastLocationAddress: address,
                            lastLocationUpdateTime: serverTimestamp()
                        });
                        console.log('Student location updated:', address);
                    } catch (err) {
                        console.error('Failed to update student location:', err);
                    }
                },
                (error) => console.warn('Student location error:', error.message),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        };

        // Initial call
        trackStudentLocation();

        // 10-minute interval (600,000 ms)
        const intervalId = setInterval(trackStudentLocation, 600000);

        return () => clearInterval(intervalId);
    }, [user?._id]);

    // Fetch street names for active buses
    useEffect(() => {
        buses.forEach(async (bus) => {
            if (isLiveBus(bus) && bus.location?.latitude && bus.location?.longitude) {
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
        if (isLiveBus(bus) && bus.location?.latitude && bus.location?.longitude) {
            setFocusedBusLocation({ lat: bus.location.latitude, lng: bus.location.longitude });
            setTrackedBus(bus); // Switch to tracking view
            setSelectedBus(null);
        }
    };

    // Sync trackedBus with real-time data to handle trip completion/status changes
    useEffect(() => {
        if (trackedBus) {
            const updatedBus = buses.find(b => b._id === trackedBus._id);
            if (updatedBus) {
                if (!isLiveBus(updatedBus)) {
                    // Trip ended or bus went offline (ghost), exit tracking mode
                    setTrackedBus(null);
                    setFocusedBusLocation(null);
                } else {
                    // Update the tracked bus object to reflect latest data (completed stops, location etc.)
                    setTrackedBus(updatedBus);

                    // Also update focused location if we are in tracking mode
                    if (updatedBus.location?.latitude && updatedBus.location?.longitude) {
                        setFocusedBusLocation({
                            lat: updatedBus.location.latitude,
                            lng: updatedBus.location.longitude
                        });
                    }
                }
            } else {
                // Bus removed from list
                setTrackedBus(null);
            }
        }
    }, [buses]);

    // WebSocket connection for real-time tracked bus updates
    const trackedBusRelayRef = useRef<RelayService | null>(null);
    useEffect(() => {
        if (!trackedBus?._id) {
            // No bus being tracked — disconnect any existing WebSocket
            if (trackedBusRelayRef.current) {
                trackedBusRelayRef.current.disconnect();
                trackedBusRelayRef.current = null;
            }
            return;
        }

        const busId = trackedBus._id;
        const relay = new RelayService();
        trackedBusRelayRef.current = relay;

        const connectRelay = async () => {
            try {
                const tokenResp = await getRelayToken(busId, 'student');
                relay.connect(tokenResp.wsUrl, {
                    onMessage: (data: any) => {
                        if (data.type === 'bus_location_update') {
                            // Update bus in the buses array with new location
                            setBuses(prev => prev.map(b => {
                                if (b._id === busId) {
                                    return {
                                        ...b,
                                        location: {
                                            latitude: data.lat,
                                            longitude: data.lng,
                                            heading: data.heading || 0
                                        },
                                        speed: data.speedMph || 0,
                                        lastUpdated: new Date().toISOString()
                                    };
                                }
                                return b;
                            }));

                            // Also update focused location if still tracking
                            setFocusedBusLocation({ lat: data.lat, lng: data.lng });
                        }
                    },
                    onOpen: () => console.log('[Student] WS connected for bus', busId),
                    onClose: () => console.log('[Student] WS disconnected for bus', busId),
                });
            } catch (err) {
                console.error('[Student] Failed to connect relay for bus', busId, err);
            }
        };

        connectRelay();

        return () => {
            relay.disconnect();
            trackedBusRelayRef.current = null;
        };
    }, [trackedBus?._id]);



    const activeBuses = buses.filter(isLiveBus);

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

            {/* Navbar - Hide in tracking mode on mobile, maybe show simplified header */}
            {!trackedBus && (
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
            )}

            {/* Tracking View */}
            {trackedBus && (
                <div className="fixed inset-0 z-40 bg-slate-900 flex flex-col md:flex-row">
                    {/* Header / Back Button for Mobile */}
                    <div className="absolute top-4 left-4 z-50 md:hidden">
                        <button
                            onClick={() => setTrackedBus(null)}
                            className="p-2 bg-white/90 backdrop-blur text-slate-800 rounded-full shadow-lg"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    </div>

                    {/* Left/Top: Map (40% Mobile, 60% Desktop) */}
                    <div className="h-[45vh] md:h-full md:w-3/5 w-full relative">
                        <MapLibreMapComponent
                            buses={buses}
                            focusedLocation={focusedBusLocation}
                            // Stop List handled in sidebar now, but markers still useful
                            stops={(() => {
                                const route = routes.find(r => r._id === trackedBus.assignedRouteId);
                                if (!route || !route.stops) return [];
                                return route.stops.map((s: any) => ({
                                    lat: s.latitude,
                                    lng: s.longitude,
                                    name: s.stopName,
                                    id: s.stopId || s._id,
                                    isCompleted: (trackedBus.completedStops || []).includes(s.stopId || s._id)
                                }));
                            })()}
                        />
                        {/* Desktop Back Button */}
                        <div className="absolute top-4 left-4 z-[1000] hidden md:block">
                            <button
                                onClick={() => setTrackedBus(null)}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-xl shadow-lg font-bold hover:bg-slate-50 transition-colors"
                            >
                                <ArrowLeft size={18} />
                                Back to Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Right/Bottom: Bottom Sheet (55% Mobile, 40% Desktop) */}
                    <div className="flex-1 bg-white md:bg-white md:border-l border-slate-200 rounded-t-[2rem] md:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:shadow-none flex flex-col overflow-hidden -mt-6 md:mt-0 relative z-10">
                        {/* Drag Handle (Mobile Visual) */}
                        <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
                            <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
                        </div>

                        {/* Bus Info Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{trackedBus.busNumber}</h2>
                                <p className="text-sm text-slate-500">{trackedBus.currentStreetName || 'On Route'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full animate-pulse">
                                    LIVE
                                </span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-100">
                            <button className="flex-1 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600">Status</button>
                            <button className="flex-1 py-3 text-sm font-medium text-slate-500 hover:text-slate-700">History</button>
                            <button className="flex-1 py-3 text-sm font-medium text-slate-500 hover:text-slate-700">Bus Info</button>
                        </div>

                        {/* Timeline Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            {(() => {
                                const route = routes.find(r => r._id === trackedBus.assignedRouteId);
                                if (!route || !route.stops) return <p className="text-center text-slate-400 mt-10">No route information available.</p>;

                                const completedStops: string[] = trackedBus.completedStops || [];
                                const nextStopIndex = route.stops.findIndex((s: any) => !completedStops.includes(s.stopId || s._id));

                                return (
                                    <div className="relative pl-6 space-y-8">
                                        {/* Vertical Timeline Line */}
                                        <div className="absolute left-[34px] top-4 bottom-4 w-0.5 bg-slate-300"></div>

                                        {route.stops.map((stop: any, idx: number) => {
                                            const isCompleted = completedStops.includes(stop.stopId || stop._id);
                                            const isNext = idx === nextStopIndex;

                                            // Determine Icon
                                            let Icon = MapPin;
                                            if (idx === 0) Icon = Clock; // Start
                                            if (idx === route.stops.length - 1) Icon = Bus; // Destination

                                            return (
                                                <div key={idx} className={`relative flex items-start gap-4 ${isCompleted ? 'opacity-60' : 'opacity-100'}`}>
                                                    {/* Timeline Dot/Icon */}
                                                    <div className={`relative z-10 w-10 h-10 rounded-full border-4 flex items-center justify-center bg-white flex-shrink-0 transition-all ${isCompleted ? 'border-green-500 text-green-500' :
                                                        isNext ? 'border-blue-500 text-blue-500 ring-4 ring-blue-100' :
                                                            'border-slate-300 text-slate-400'
                                                        }`}>
                                                        <Icon size={16} fill={isCompleted ? "currentColor" : "none"} />
                                                    </div>

                                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h4 className={`font-bold text-base ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                                                {stop.stopName}
                                                            </h4>
                                                            <span className="text-xs font-mono text-slate-400">
                                                                {/* Time placeholder */}
                                                                Stop {idx + 1}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mb-2 truncate max-w-[200px]">
                                                            {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                                                        </p>

                                                        {isNext && (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                                                Arriving Next
                                                            </div>
                                                        )}
                                                        {isCompleted && (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold">
                                                                Reached
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 ${trackedBus ? 'hidden' : ''}`}>

                {/* Substitute Bus Warning (Phase 5.3) */}
                {substituteBus && assignedBus && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.02 }}
                        className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold text-red-300">Substitute Bus Assigned</h4>
                            <p className="text-sm text-red-200">
                                Your regular bus <strong>{assignedBus?.busNumber}</strong> is in maintenance.
                                Please board substitute bus <strong>{substituteBus.busNumber}</strong> ({substituteBus.numberPlate}).
                            </p>
                        </div>
                    </motion.div>
                )}

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
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all ${isLiveBus(bus)
                                        ? 'bg-green-500/20 border-green-500/30 hover:border-green-500/50'
                                        : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Bus size={16} className={isLiveBus(bus) ? 'text-green-400' : 'text-slate-400'} />
                                        <span className="font-bold text-white">{bus.busNumber}</span>
                                        {isLiveBus(bus) && (
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Live Map Section - REMOVE since we have tracking view now, or keep as summary? 
                    Actually, let's keep it as "Active Buses" overview map but remove the stop list overlay from here.
                */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-800/50 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden h-[300px] flex flex-col cursor-pointer hover:border-blue-500/30 transition-colors"
                >
                    <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <MapPin size={20} className="text-blue-400" />
                            Live Fleet Overview
                        </h3>
                        <div className="flex items-center gap-2">
                            {activeBuses.length > 0 && (
                                <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    {activeBuses.length} LIVE
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Map Section */}
                    <div className="flex-1 relative">
                        <MapLibreMapComponent
                            buses={buses}
                            // Show stops for assigned bus on map
                            stops={(() => {
                                const targetBus = assignedBus || buses.find(b => b.status === 'ON_ROUTE');
                                if (!targetBus || !targetBus.assignedRouteId) return [];

                                const route = routes.find(r => r._id === targetBus.assignedRouteId);
                                if (!route || !route.stops) return [];

                                return route.stops.map((s: any) => ({
                                    lat: s.latitude,
                                    lng: s.longitude,
                                    name: s.stopName,
                                    id: s.stopId || s._id,
                                    isCompleted: (targetBus.completedStops || []).includes(s.stopId || s._id)
                                }));
                            })()}
                        />

                        {/* Desktop-Only Stop List Overlay */}
                        {(() => {
                            const targetBus = assignedBus || buses.find(b => b.status === 'ON_ROUTE');
                            if (!targetBus || !targetBus.assignedRouteId) return null;

                            const route = routes.find(r => r._id === targetBus.assignedRouteId);
                            if (!route || !route.stops) return null;

                            const completedStops = targetBus.completedStops || [];
                            const nextStopIndex = route.stops.findIndex((s: any) => !completedStops.includes(s.stopId || s._id));

                            return (
                                <div className="hidden md:flex absolute top-4 right-4 z-[400] w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200 flex-col max-h-[260px] overflow-hidden">
                                    <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                            <MapPin className="text-blue-600" size={16} />
                                            Route Stops (Quick View)
                                        </h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{route.routeName}</p>
                                    </div>
                                    <div className="overflow-y-auto flex-1 p-2">
                                        <div className="relative pl-3 space-y-0">
                                            {/* Vertical Line */}
                                            <div className="absolute left-[8px] top-3 bottom-3 w-0.5 bg-slate-200"></div>

                                            {route.stops.map((stop: any, idx: number) => {
                                                const isCompleted = completedStops.includes(stop.stopId || stop._id);
                                                const isNext = idx === nextStopIndex;

                                                return (
                                                    <div key={idx} className={`relative flex gap-2 p-2 rounded-lg transition-colors ${isNext ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}>
                                                        {/* Dot */}
                                                        <div className={`relative z-10 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${isCompleted ? 'border-green-500' :
                                                            isNext ? 'border-blue-600 ring-2 ring-blue-50' :
                                                                'border-slate-300'
                                                            }`}>
                                                            {isCompleted && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                            {isNext && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center">
                                                                <p className={`text-xs font-semibold truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                                    {stop.stopName}
                                                                </p>
                                                                {isNext && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1 rounded">Next</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
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
                                    className={`bg-slate-800/50 backdrop-blur-md border rounded-2xl p-5 cursor-pointer transition-all ${isLiveBus(bus)
                                        ? 'border-green-500/30 hover:border-green-500/50'
                                        : 'border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${isLiveBus(bus) ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
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
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLiveBus(bus) ? 'bg-green-500/20 text-green-400' :
                                                bus.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {isLiveBus(bus) ? 'LIVE' : bus.status || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <User size={14} />
                                            <span>{bus.driverName || 'Unassigned'}</span>
                                        </div>
                                        {isLiveBus(bus) && busLocations[bus._id] && (
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
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLiveBus(selectedBus) ? 'bg-green-500/20' : 'bg-blue-500/20'
                                        }`}>
                                        <Bus size={24} className={isLiveBus(selectedBus) ? 'text-green-400' : 'text-blue-400'} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{selectedBus.busNumber}</h3>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isLiveBus(selectedBus) ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {isLiveBus(selectedBus) ? 'LIVE' : selectedBus.status}
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
                                {isLiveBus(selectedBus) && busLocations[selectedBus._id] && (
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MapPin size={16} className="text-green-400" />
                                            <span className="text-sm text-green-400 font-medium">Current Location</span>
                                        </div>
                                        <p className="text-white font-semibold">{busLocations[selectedBus._id]}</p>
                                    </div>
                                )}
                                {selectedBus.speed != null && isLiveBus(selectedBus) && (
                                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                                        <span className="text-slate-400">Speed</span>
                                        <span className="font-bold text-white">{Math.round(selectedBus.speed || 0)} mph</span>
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
                                {isLiveBus(selectedBus) && (
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
