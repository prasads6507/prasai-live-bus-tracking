import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navigation, LogOut, AlertCircle, User, Bus, Settings, Phone, Search, X, MapPin } from 'lucide-react';
import { getDriverBuses, updateBusLocation, saveTripHistory, startNewTrip, endCurrentTrip, searchDriverBuses, checkProximity } from '../services/api';
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStreetName } from '../services/geocoding';

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const DriverDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();

    // State
    const [buses, setBuses] = useState<any[]>([]);
    const [selectedBusId, setSelectedBusId] = useState<string>('');
    const [stops, setStops] = useState<any[]>([]);
    const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());
    const [driverDetails, setDriverDetails] = useState<any>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [currentSpeed, setCurrentSpeed] = useState<number>(0);
    const [locationPermission, setLocationPermission] = useState<PermissionState>('prompt');
    const [tripId, setTripId] = useState<string | null>(null);

    const [showSettings, setShowSettings] = useState(false);

    const [manualEntryMode, setManualEntryMode] = useState(false);
    const [manualBusNumber, setManualBusNumber] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [currentCoords, setCurrentCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [lastSentTime, setLastSentTime] = useState<string>('');
    const [currentStreetName, setCurrentStreetName] = useState<string>('');

    // Refs for tracking
    const watchIdRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const lastHistorySaveRef = useRef<number>(0); // Track when we last saved to history
    const currentPositionRef = useRef<{ latitude: number, longitude: number, speed: number, heading: number } | null>(null);

    // Proximity Check Interval (Phase 4.3)
    useEffect(() => {
        if (!tripId || !selectedBusId) return;
        const selectedBus = buses.find(b => b._id === selectedBusId);
        if (!selectedBus) return;

        const interval = setInterval(() => {
            if (currentCoords) {
                checkProximity({
                    busId: selectedBus._id,
                    location: currentCoords,
                    tripId: tripId,
                    routeId: selectedBus.assignedRouteId
                }).catch((err: any) => console.error('Proximity check failed', err));
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [tripId, selectedBusId, buses, currentCoords]);



    // Fetch Stops when Bus is Selected
    useEffect(() => {
        const fetchStops = async () => {
            const selectedBus = buses.find(b => b._id === selectedBusId);
            if (!selectedBus || !selectedBus.assignedRouteId) {
                setStops([]);
                return;
            }

            try {
                const q = query(collection(db, 'stops'), where('routeId', '==', selectedBus.assignedRouteId));
                const snapshot = await getDocs(q);
                const fetchedStops = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
                // Sort by order/sequence if available, assuming order field exists
                fetchedStops.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
                setStops(fetchedStops);
            } catch (err) {
                console.error("Failed to fetch stops:", err);
            }
        };

        if (selectedBusId) {
            fetchStops();
        }
    }, [selectedBusId, buses]);

    // Check Stop Proximity
    const checkStopCompletion = async (lat: number, lng: number) => {
        if (!tripId || stops.length === 0) return;

        stops.forEach(async (stop) => {
            if (completedStops.has(stop.stopId || stop._id)) return; // Already completed locally

            if (stop.latitude && stop.longitude) {
                const dist = getDistanceFromLatLonInKm(lat, lng, stop.latitude, stop.longitude);
                // Threshold: 0.1km = 100m
                if (dist < 0.1) {
                    console.log(`Arrived at stop: ${stop.stopName}`);

                    // Update local state to avoid repeated writes
                    setCompletedStops(prev => new Set(prev).add(stop.stopId || stop._id));

                    // Write completion to Firestore (Trip History)
                    try {
                        const stopRef = doc(db, 'trips', tripId, 'stops', stop.stopId || stop._id);
                        await setDoc(stopRef, {
                            stopId: stop.stopId || stop._id,
                            stopName: stop.stopName,
                            arrivedAt: serverTimestamp(),
                            status: 'COMPLETED'
                        });

                        // Sync to BUS document for real-time student view
                        const busRef = doc(db, 'buses', selectedBusId);
                        const updatedCompletedStops = Array.from(new Set([...Array.from(completedStops), stop.stopId || stop._id]));
                        await updateDoc(busRef, {
                            completedStops: updatedCompletedStops
                        });

                    } catch (err) {
                        console.error("Failed to mark stop as completed:", err);
                    }
                }
            }
        });
    };

    // 1. Check Location Permissions & Fetch Buses
    useEffect(() => {
        const init = async () => {
            try {
                // Check permissions
                if (navigator.permissions) {
                    const result = await navigator.permissions.query({ name: 'geolocation' });
                    setLocationPermission(result.state);
                    result.onchange = () => setLocationPermission(result.state);
                }

                // Fetch Buses
                const response = await getDriverBuses();
                console.log("DRIVER BUSES RESPONSE:", response);
                if (response.success) {
                    setBuses(response.data);
                    // Set driver details from local storage if available
                    const storedUser = localStorage.getItem('driver_user');
                    if (storedUser) {
                        setDriverDetails(JSON.parse(storedUser));
                    }
                } else {
                    console.warn("Failed to fetch buses:", response.message);
                }
            } catch (err: any) {
                console.error("Failed to init driver dashboard", err);
                setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
            }
        };
        init();
    }, []);

    // 2. Resume Trip on Mount
    useEffect(() => {
        const savedTrip = localStorage.getItem('driver_active_trip');
        if (savedTrip) {
            try {
                const { tripId, busId } = JSON.parse(savedTrip);
                console.log("Resuming active trip:", tripId);
                setSelectedBusId(busId);
                setTripId(tripId);
                setIsTracking(true);
                // Wait for busId state to settle or pass it directly
                startTrackingLoop(busId, tripId);
            } catch (e) {
                console.error("Failed to parse active trip", e);
            }
        }
    }, []);

    // 3. Start Trip (User Action)
    const startTrip = async () => {
        if (!selectedBusId) return;

        // Generate a new trip ID and start the trip on the backend
        const newTripId = `trip-${selectedBusId}-${Date.now()}`;
        setTripId(newTripId);

        try {
            await startNewTrip(selectedBusId, newTripId);
            console.log('Trip started:', newTripId);

            // Persist to localStorage
            localStorage.setItem('driver_active_trip', JSON.stringify({ tripId: newTripId, busId: selectedBusId }));

            // Reset completed stops on the bus document for the new trip
            const busRef = doc(db, 'buses', selectedBusId);
            await updateDoc(busRef, {
                completedStops: []
            });

            // Start Tracking
            startTrackingLoop(selectedBusId, newTripId);
        } catch (err) {
            console.error('Failed to start trip on backend', err);
            setError("Failed to start trip. Please check network.");
        }
    };

    const startTrackingLoop = async (busId: string, currentTripId: string) => {
        console.log("Starting tracking loop for trip:", currentTripId);
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }

        setIsTracking(true);
        setLocationError(null);

        // Update status to ON_ROUTE immediately
        await updateBusStatus('ON_ROUTE', busId);

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                const { latitude, longitude, speed, heading } = position.coords;

                // Store current position in ref for history saving
                currentPositionRef.current = {
                    latitude,
                    longitude,
                    speed: Math.round((speed || 0) * 3.6),
                    heading: heading || 0
                };

                // Update UI state
                setCurrentSpeed((speed || 0) * 3.6);
                setCurrentCoords({ lat: latitude, lng: longitude });
                setLocationError(null);

                // Update reverse geocoded street name (throttled to avoid API spam)
                if (now - lastUpdateRef.current > 4000) {
                    getStreetName(latitude, longitude).then(street => setCurrentStreetName(street));
                }

                // Write live location directly to Firestore every 5 seconds
                if (now - lastUpdateRef.current > 5000) {
                    try {
                        console.log(`--- WRITING LOCATION TO FIRESTORE FOR BUS ${busId} ---`);
                        const speedKmh = Math.round((speed || 0) * 3.6);
                        const headingVal = heading || 0;

                        // Direct Firestore write for real-time updates
                        const busRef = doc(db, 'buses', busId);
                        await updateDoc(busRef, {
                            location: { latitude, longitude },
                            currentLocation: { lat: latitude, lng: longitude },
                            currentHeading: headingVal,
                            currentSpeed: speedKmh,
                            speed: speedKmh,
                            heading: headingVal,
                            lastLocationUpdate: serverTimestamp(),
                            lastUpdated: new Date().toISOString(),
                            currentTripId: currentTripId || null,
                            status: currentTripId ? 'ON_ROUTE' : 'ACTIVE'
                        });

                        // Check Stop Completion (Phase 5.1)
                        if (currentTripId) {
                            checkStopCompletion(latitude, longitude);
                        }

                        lastUpdateRef.current = now;
                        setLastSentTime(new Date().toLocaleTimeString());
                        console.log('Firestore location update written successfully');
                    } catch (err: any) {
                        console.error("Failed to write location to Firestore", err);
                        // Fallback to API call
                        try {
                            await updateBusLocation(busId, {
                                latitude,
                                longitude,
                                speed: Math.round((speed || 0) * 3.6),
                                heading: heading || 0,
                                status: currentTripId ? 'ON_ROUTE' : 'ACTIVE'
                            });
                            lastUpdateRef.current = now;
                            setLastSentTime(new Date().toLocaleTimeString());
                        } catch (apiErr: any) {
                            if (apiErr.response?.status === 401) {
                                setError('Session expired. Please log in again.');
                                endTrip();
                            }
                        }
                    }
                }

                // Save to trip path history every 15 seconds
                if (currentTripId && now - lastHistorySaveRef.current > 15000) {
                    console.log('--- SAVING TRIP PATH POINT ---', currentTripId);

                    // Validate coordinates
                    if (latitude === 0 && longitude === 0) {
                        console.warn('Skipping history save: Invalid coordinates (0,0)');
                        return;
                    }

                    // 1. Try Direct Firestore write (Real-time subcollection)
                    try {
                        const pathRef = collection(db, 'trips', currentTripId, 'path');
                        await addDoc(pathRef, {
                            lat: latitude,
                            lng: longitude,
                            heading: heading || 0,
                            speed: Math.round((speed || 0) * 3.6),
                            recordedAt: serverTimestamp()
                        });
                        console.log('Direct Firestore path write successful');
                    } catch (err) {
                        console.warn('Direct Firestore path write failed (likely permissions):', err);
                    }

                    // 2. Try API save (Legacy/Fallback)
                    try {
                        const result = await saveTripHistory(busId, currentTripId, {
                            latitude,
                            longitude,
                            speed: Math.round((speed || 0) * 3.6),
                            heading: heading || 0,
                            timestamp: new Date().toISOString()
                        });
                        console.log('API trip history save result:', result);
                    } catch (err) {
                        console.error('API trip history save failed:', err);
                    }

                    lastHistorySaveRef.current = now;
                }
            },
            (error) => {
                console.error("Location Error:", error);
                setLocationError(error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 5000
            }
        );
    };

    // 3. Stop Tracking
    const endTrip = async () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
        setCurrentSpeed(0);

        // End trip on backend (saves final state)
        if (tripId && selectedBusId) {
            try {
                await endCurrentTrip(selectedBusId, tripId);
                console.log('Trip ended:', tripId);
            } catch (err) {
                console.error('Failed to end trip on backend', err);
            }
        }

        // Clear persistence
        localStorage.removeItem('driver_active_trip');

        setTripId(null);
        lastHistorySaveRef.current = 0;
        currentPositionRef.current = null;

        // Reset bus status
        await updateBusStatus('ACTIVE', selectedBusId);

        // Reset Selection to "Redirect" to Dashboard Home
        setSelectedBusId('');
        setManualBusNumber('');
        setManualEntryMode(false);
    };

    const updateBusStatus = async (status: string, busId?: string) => {
        const targetBusId = busId || selectedBusId;
        if (!targetBusId) return;
        try {
            await updateBusLocation(targetBusId, {
                status,
                speed: 0
            } as any);
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    const handleLogout = () => {
        endTrip();
        localStorage.removeItem('driver_token');
        localStorage.removeItem('driver_user');
        navigate(`/${orgSlug}/login`);
    };



    const handleManualSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualBusNumber.trim()) return;

        setIsSearching(true);
        setError(null);
        try {
            const response = await searchDriverBuses(manualBusNumber);
            // Assuming response has { success: true, data: [...] } structure like getDriverBuses
            if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                setBuses(response.data);
            } else if (Array.isArray(response) && response.length > 0) {
                // Handle case where it returns direct array
                setBuses(response);
            } else {
                setError('No bus found with that number');
                setBuses([]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to search bus');
        } finally {
            setIsSearching(false);
        }
    };

    const handleResetBusList = async () => {
        setManualEntryMode(false);
        setManualBusNumber('');
        setError(null);
        try {
            const response = await getDriverBuses();
            if (response.success) setBuses(response.data);
        } catch (err) {
            console.error("Failed to fetch buses:", err);
        }
    };

    // UI Components
    if (locationPermission === 'denied') {
        return (
            <div className="min-h-screen bg-red-50 p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-red-700">Location Access Denied</h2>
                <p className="text-red-600 mt-2">Please enable location services in your browser settings to use the Driver App.</p>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-200 shadow-lg">
                        <Navigation size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800 leading-tight">Driver Portal</h1>
                        <p className="text-xs text-slate-500 font-medium">{driverDetails?.name || 'Welcome'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
                        <Settings size={20} />
                    </button>
                    <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 flex flex-col gap-5 max-w-md mx-auto w-full pb-20">

                {/* Status Card */}
                <div className={`relative overflow-hidden rounded-3xl p-6 text-center shadow-xl transition-all duration-300 transform ${isTracking
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-200 scale-100'
                    : 'bg-white text-slate-800 shadow-slate-200 scale-100'
                    }`}>

                    {/* Status Indicator */}
                    <div className="relative z-10 flex flex-col items-center">
                        <div className={`mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${isTracking ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-slate-100 text-slate-500'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></div>
                            Current Status
                        </div>

                        <div className="text-3xl font-black mb-4 tracking-tight">
                            {isTracking ? 'ON TRIP' : 'READY FOR TRIP'}
                        </div>

                        {/* Speedometer or Icon */}
                        {isTracking ? (
                            <div className="flex flex-col items-center">
                                <div className="text-7xl font-black tabular-nums leading-none tracking-tighter">
                                    {Math.round(currentSpeed)}
                                </div>
                                <div className="text-lg font-medium opacity-80 mt-1">km/h</div>
                            </div>
                        ) : (
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
                                <Navigation size={40} className="text-slate-300" />
                            </div>
                        )}
                    </div>

                    {/* Background decoration */}
                    <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                        <Navigation size={150} />
                    </div>
                </div>

                {/* Bus Selection / Trip Controls */}
                <div className="space-y-4">
                    {!isTracking ? (
                        <>
                            {!selectedBusId ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                            <Bus size={18} className="text-blue-500" />
                                            {manualEntryMode ? 'Search Bus' : 'Select Your Bus'}
                                        </h3>
                                        {manualEntryMode && (
                                            <button onClick={handleResetBusList} className="text-xs text-blue-600 font-bold uppercase tracking-wider">
                                                Show List
                                            </button>
                                        )}
                                    </div>

                                    {manualEntryMode && (
                                        <div className="p-4 bg-white border-b border-slate-100">
                                            <form onSubmit={handleManualSearch} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={manualBusNumber}
                                                    onChange={(e) => setManualBusNumber(e.target.value)}
                                                    placeholder="Enter bus number..."
                                                    className="flex-1 bg-slate-50 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    autoFocus
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isSearching}
                                                    className="bg-blue-600 text-white p-3 rounded-xl disabled:opacity-50"
                                                >
                                                    {isSearching ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : <Search size={20} />}
                                                </button>
                                            </form>
                                        </div>
                                    )}

                                    <div className="p-4 grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto">
                                        {buses.length > 0 ? (
                                            buses.map(bus => (
                                                <button
                                                    key={bus._id}
                                                    onClick={() => setSelectedBusId(bus._id)}
                                                    className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-lg group-hover:text-blue-700">{bus.busNumber}</div>
                                                        <div className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                            {bus.routeName || bus.route?.routeName || bus.assignedRoute?.routeName || bus.route?.name || 'No Route Assigned'}
                                                        </div>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-200 group-hover:text-blue-700 transition-colors">
                                                        <Navigation size={16} />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-slate-400">
                                                {manualEntryMode ? 'No buses found with that number.' : 'No buses found assigned to you.'}
                                            </div>
                                        )}

                                        {!manualEntryMode && (
                                            <button
                                                onClick={() => setManualEntryMode(true)}
                                                className="mt-2 w-full py-3 text-sm text-blue-600 font-medium bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                                            >
                                                Bus not listed? Search Manually
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Selected Bus Card */}
                                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Selected Vehicle</p>
                                                <h3 className="text-2xl font-black text-slate-800">
                                                    {buses.find(b => b._id === selectedBusId)?.busNumber}
                                                </h3>
                                                <p className="text-sm text-slate-500 font-medium mt-1">
                                                    {buses.find(b => b._id === selectedBusId)?.routeName || buses.find(b => b._id === selectedBusId)?.route?.routeName || buses.find(b => b._id === selectedBusId)?.assignedRoute?.routeName || 'General Route'}
                                                </p>
                                            </div>
                                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                                <Bus size={24} />
                                            </div>
                                        </div>

                                        {/* Switch Bus Button Removed */}
                                    </div>

                                    {/* Driver Info Card */}
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <User size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-slate-400 font-bold uppercase">Driver</p>
                                            <p className="font-bold text-slate-800">{driverDetails?.name || 'Unknown Driver'}</p>
                                        </div>
                                        {driverDetails?.phone && (
                                            <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                                                <Phone size={14} />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={startTrip}
                                        className="w-full py-4 rounded-xl font-bold text-lg bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Navigation size={22} />
                                        Start Trip
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 animate-pulse">
                                        <Navigation size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Currently Driving</p>
                                        <h3 className="text-xl font-black text-slate-800">
                                            {buses.find(b => b._id === selectedBusId)?.busNumber}
                                        </h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-full animate-[progress_2s_ease-in-out_infinite] origin-left"></div>
                                </div>
                                <p className="text-center text-xs text-slate-400 mt-3 font-medium">
                                    Sharing live location with college portal...
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-4 text-center">
                                    <div className="p-2 bg-slate-50 rounded-lg">
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Last Update</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{lastSentTime || '--:--:--'}</p>
                                    </div>
                                    <div className="p-2 bg-slate-50 rounded-lg">
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Location</p>
                                        <p className="font-bold text-slate-700 text-xs mt-0.5 flex items-center gap-1">
                                            <MapPin size={10} className="text-green-500 shrink-0" />
                                            <span className="truncate">{currentStreetName || (currentCoords ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}` : 'Waiting...')}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={endTrip}
                                className="w-full py-4 rounded-xl font-bold text-lg bg-white text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                                <LogOut size={22} />
                                End Trip
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-bold">Dashboard Error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                {locationError && (
                    <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        {locationError}
                    </div>
                )}

                {/* Instructions */}
                <div className="text-center text-xs text-slate-400 mt-4 px-4">
                    Keep this screen open while driving to ensure location updates are sent.
                </div>

            </div>

            {/* Settings Modal */}
            {
                showSettings && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-lg text-slate-800">Driver Profile</h3>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold mb-3">
                                        {driverDetails?.name?.charAt(0) || 'D'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-xl text-slate-800">{driverDetails?.name || 'Unknown Driver'}</p>
                                        <p className="text-slate-500">{driverDetails?.email || 'No email'}</p>
                                        {driverDetails?.phone && <p className="text-slate-400 text-sm mt-1">{driverDetails.phone}</p>}
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full py-3 text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    <LogOut size={20} /> Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DriverDashboard;
