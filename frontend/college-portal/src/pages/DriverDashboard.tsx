import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navigation, LogOut, AlertCircle, Bus, Settings, Search, X, MapPin } from 'lucide-react';
import { getDriverBuses, searchDriverBuses, startNewTrip, checkProximity, getRelayToken, uploadTripHistory } from '../services/api';
import { api } from '../services/api';
import { doc, updateDoc, collection, getDocs, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStreetName } from '../services/geocoding';
import relayService from '../services/relay';
import { encodePolyline } from '../utils/polyline';

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

    const watchIdRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const lastHistorySaveRef = useRef<number>(0); // Track when we last saved to history
    const currentPositionRef = useRef<{ latitude: number, longitude: number, speed: number, heading: number } | null>(null);
    const liveTrailBufferRef = useRef<{ lat: number; lng: number; timestamp: string }[]>([]); // Buffer for 1s interval points
    const prevPositionRef = useRef<{ lat: number; lng: number; ts: number } | null>(null); // For dead-reckoning speed estimate

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
            // Attempt to start trip on backend, MUST succeed to proceed
            await startNewTrip(selectedBusId, newTripId);
            console.log('Trip started:', newTripId);

            // Persist to localStorage
            localStorage.setItem('driver_active_trip', JSON.stringify({ tripId: newTripId, busId: selectedBusId }));

            // Start Tracking
            startTrackingLoop(selectedBusId, newTripId);
        } catch (err: any) {
            console.error('Critical failure starting trip:', err);
            setError(err.response?.data?.message || err.message || "Failed to start trip on server. Cannot track.");
            setTripId(null);
        }
    };

    // In-memory buffer for trip history points (uploaded once at trip end)
    const historyBufferRef = useRef<Array<{ lat: number; lng: number; speed: number; heading: number; timestamp: string }>>([]);

    const startTrackingLoop = async (busId: string, currentTripId: string) => {
        console.log("Starting tracking loop for trip:", currentTripId);
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }

        setIsTracking(true);
        setLocationError(null);
        historyBufferRef.current = [];

        // Update status to ON_ROUTE immediately
        await updateBusStatus('ON_ROUTE', busId);

        // Connect to WebSocket relay
        try {
            const tokenResp = await getRelayToken(busId, 'driver');
            console.log('[Relay] Got relay token, connecting WS...');
            relayService.connect(tokenResp.wsUrl, {
                onOpen: () => console.log('[Relay] Driver WS connected for bus', busId),
                onClose: () => console.warn('[Relay] Driver WS disconnected'),
                onMessage: (data: any) => {
                    if (data.type === 'error') {
                        console.error('[Relay] Server error:', data.message);
                    }
                },
            });
        } catch (err) {
            console.error('[Relay] Failed to get relay token, falling back to API mode:', err);
            // Continue without relay — GPS still buffers locally
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                const { latitude, longitude, speed, heading, accuracy } = position.coords;

                // Quality filter: drop inaccurate points
                if (accuracy && accuracy > 25) {
                    console.warn('Dropping low-accuracy GPS point:', accuracy, 'm');
                    return;
                }

                // ── Speed: use browser value if available, otherwise dead-reckon ──────
                // Most browsers report null for speed on desktop/iOS/Firefox.
                // We estimate speed from distance between consecutive GPS points.
                let speedMps: number;
                if (speed !== null && speed > 0) {
                    // Browser reported a real speed — trust it
                    speedMps = Math.max(0, speed);
                } else if (prevPositionRef.current) {
                    const dtSeconds = (now - prevPositionRef.current.ts) / 1000;
                    if (dtSeconds > 0.5) {
                        const distM = getDistanceFromLatLonInKm(
                            prevPositionRef.current.lat, prevPositionRef.current.lng,
                            latitude, longitude
                        ) * 1000;
                        const rawMps = distM / dtSeconds;
                        // Clamp at 36 m/s (~80 mph) to reject GPS position jumps
                        speedMps = Math.min(36, Math.max(0, rawMps));
                    } else {
                        speedMps = 0;
                    }
                } else {
                    speedMps = 0;
                }

                // Always update previous position for next estimate
                prevPositionRef.current = { lat: latitude, lng: longitude, ts: now };

                const speedMph = Math.round(speedMps * 2.23694);
                const headingVal = heading || 0;

                // Store current position in ref
                currentPositionRef.current = {
                    latitude,
                    longitude,
                    speed: speedMph,
                    heading: headingVal
                };

                // Add to live trail buffer
                liveTrailBufferRef.current.push({
                    lat: latitude,
                    lng: longitude,
                    timestamp: new Date().toISOString()
                });
                if (liveTrailBufferRef.current.length > 20) {
                    liveTrailBufferRef.current.shift();
                }

                // Buffer point for trip history (uploaded once at trip end)
                historyBufferRef.current.push({
                    lat: latitude,
                    lng: longitude,
                    speed: speedMph,
                    heading: headingVal,
                    timestamp: new Date().toISOString()
                });

                // Update UI state
                setCurrentSpeed(speedMph);
                setCurrentCoords({ lat: latitude, lng: longitude });
                setLocationError(null);

                // Update reverse geocoded street name (throttled)
                if (now - lastUpdateRef.current > 4000) {
                    getStreetName(latitude, longitude).then(street => setCurrentStreetName(street));
                }

                // Send location via WebSocket relay every ~1 second
                if (now - lastUpdateRef.current > 1000) {
                    const sent = relayService.sendLocation({
                        tripId: currentTripId,
                        lat: latitude,
                        lng: longitude,
                        speedMps,
                        heading: headingVal,
                        accuracyM: accuracy || 0,
                    });

                    console.log(`[Driver] ${sent ? 'Sent' : 'Queued'} location: lat=${latitude.toFixed(5)} lng=${longitude.toFixed(5)} speedMps=${speedMps.toFixed(1)}`);

                    if (sent) {
                        lastUpdateRef.current = now;
                        setLastSentTime(new Date().toLocaleTimeString());
                    }

                    // Check Stop Completion
                    if (currentTripId) {
                        checkStopCompletion(latitude, longitude);
                    }
                }
            },
            (error) => {
                console.error('Geolocation error:', error.message);
                setLocationError(error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    // 3. Stop Tracking
    const endTrip = async () => {
        // 1. Stop Geolocation Immediately
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        // 2. Disconnect WebSocket relay
        relayService.disconnect();

        // 3. Clear Persistence IMMEDIATELY (Critical to prevent auto-resume on reload)
        localStorage.removeItem('driver_active_trip');

        // 4. Upload buffered trip history in a single write
        if (tripId && historyBufferRef.current.length > 0) {
            try {
                const points = historyBufferRef.current;
                let totalDistanceM = 0;
                let maxSpeedMph = 0;
                let sumSpeedMph = 0;

                for (let i = 0; i < points.length; i++) {
                    maxSpeedMph = Math.max(maxSpeedMph, points[i].speed);
                    sumSpeedMph += points[i].speed;
                    if (i > 0) {
                        totalDistanceM += getDistanceFromLatLonInKm(
                            points[i - 1].lat, points[i - 1].lng,
                            points[i].lat, points[i].lng
                        ) * 1000;
                    }
                }

                const firstTs = new Date(points[0].timestamp).getTime();
                const lastTs = new Date(points[points.length - 1].timestamp).getTime();
                const durationSec = Math.round((lastTs - firstTs) / 1000);

                console.log(`[History] Uploading ${points.length} buffered points for trip ${tripId}`);

                const coords: [number, number][] = points.map((p: any) => [p.lat, p.lng]);
                const polylineStr = encodePolyline(coords);

                await uploadTripHistory(tripId, {
                    distanceMeters: Math.round(totalDistanceM),
                    durationSeconds: durationSec,
                    maxSpeedMph: Math.round(maxSpeedMph),
                    avgSpeedMph: Math.round(sumSpeedMph / points.length),
                    pointsCount: points.length,
                    polyline: polylineStr,
                });
                console.log('[History] Upload complete');
            } catch (err) {
                console.error('[History] Failed to upload trip history:', err);
                // Save to localStorage as fallback
                try {
                    localStorage.setItem(`trip_history_${tripId}`, JSON.stringify(historyBufferRef.current));
                    console.log('[History] Saved to localStorage as fallback');
                } catch (_) { }
            }
        }

        // 5. Reset Local State
        setIsTracking(false);
        setCurrentSpeed(0);
        const endingTripId = tripId;
        setTripId(null);
        lastHistorySaveRef.current = 0;
        currentPositionRef.current = null;
        prevPositionRef.current = null; // Reset dead-reckoning state
        liveTrailBufferRef.current = [];
        historyBufferRef.current = [];

        // 6. End trip on backend (Atomic Transaction)
        if (endingTripId && selectedBusId) {
            try {
                await api.post(`/driver/trips/${endingTripId}/end`, { busId: selectedBusId });
                console.log('Trip ended atomically via API:', endingTripId);
            } catch (err) {
                console.error('Failed to end trip on backend', err);
            }
        }

        // Reset Selection to "Redirect" to Dashboard Home
        setSelectedBusId('');
        setManualBusNumber('');
        setManualEntryMode(false);
    };

    const updateBusStatus = async (status: string, busId?: string) => {
        const targetBusId = busId || selectedBusId;
        if (!targetBusId) return;
        try {
            // Direct Firestore update for status changes (minimal writes)
            const busRef = doc(db, 'buses', targetBusId);
            await updateDoc(busRef, {
                status,
                lastUpdated: new Date().toISOString()
            });
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
                                <div className="text-lg font-medium opacity-80 mt-1">mph</div>
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
                                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden">
                                    <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Bus size={18} className="text-blue-600" />
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

                                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                        {buses.length > 0 ? (
                                            buses.map(bus => (
                                                <button
                                                    key={bus._id}
                                                    onClick={() => setSelectedBusId(bus._id)}
                                                    className="w-full flex items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left bg-white shadow-sm"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                                                            <Bus size={24} className="text-slate-400 group-hover:text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 text-xl group-hover:text-blue-800 leading-none mb-1">{bus.busNumber}</div>
                                                            <div className="text-sm text-slate-400 font-medium flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                                {bus.routeName || bus.route?.routeName || bus.assignedRoute?.routeName || bus.route?.name || 'No Route Assigned'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                        <Navigation size={18} />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-center py-12 text-slate-400">
                                                <Bus size={40} className="mx-auto mb-3 opacity-20" />
                                                <p className="font-medium">
                                                    {manualEntryMode ? 'No buses found with that number.' : 'No buses currently assigned to you.'}
                                                </p>
                                                <p className="text-xs mt-1">Please contact your administrator if this is an error.</p>
                                            </div>
                                        )}

                                        {!manualEntryMode && (
                                            <button
                                                onClick={() => setManualEntryMode(true)}
                                                className="mt-4 w-full py-4 text-sm text-blue-600 font-bold bg-blue-50/50 rounded-2xl hover:bg-blue-100 transition-all border border-blue-100"
                                            >
                                                Bus not listed? Search Manually
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Selected Bus Card */}
                                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200 border border-slate-100 relative overflow-hidden">
                                        <div className="relative z-10 flex justify-between items-start">
                                            <div>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 px-1">Selected Vehicle</p>
                                                <h3 className="text-4xl font-black text-slate-900 leading-none">
                                                    {buses.find(b => b._id === selectedBusId)?.busNumber}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-3 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full w-fit">
                                                    <MapPin size={14} />
                                                    <span className="text-sm font-bold truncate max-w-[200px]">
                                                        {buses.find(b => b._id === selectedBusId)?.routeName || buses.find(b => b._id === selectedBusId)?.route?.routeName || buses.find(b => b._id === selectedBusId)?.assignedRoute?.routeName || 'General Route'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                                <Bus size={32} />
                                            </div>
                                        </div>
                                        <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12 bg-blue-600 w-32 h-32 rounded-full"></div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSelectedBusId('')}
                                            className="flex-1 py-4 rounded-2xl font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
                                        >
                                            Change Bus
                                        </button>
                                        <button
                                            onClick={startTrip}
                                            className="flex-[2] py-4 rounded-2xl font-black text-xl bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                        >
                                            <Navigation size={24} />
                                            START TRIP
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200 border border-slate-100">
                                <div className="flex items-center gap-5 mb-6">
                                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100 animate-pulse">
                                        <Bus size={32} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">On Trip</p>
                                        <h3 className="text-3xl font-black text-slate-900 leading-none">
                                            {buses.find(b => b._id === selectedBusId)?.busNumber}
                                        </h3>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 w-full animate-[progress_2s_ease-in-out_infinite] origin-left"></div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Speed</p>
                                            <p className="text-xl font-black text-slate-800 tabular-nums">
                                                {Math.round(currentSpeed)} <span className="text-xs font-medium text-slate-500">mph</span>
                                            </p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Pulse</p>
                                            <p className="text-xl font-black text-slate-800 tabular-nums">
                                                {lastSentTime ? lastSentTime.split(' ')[0] : '--:--:--'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3">
                                        <MapPin size={18} className="text-blue-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[10px] uppercase text-blue-600 font-black tracking-widest mb-0.5">Current Location</p>
                                            <p className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight">
                                                {currentStreetName || (currentCoords ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}` : 'Detecting...')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={endTrip}
                                className="w-full py-5 rounded-2xl font-black text-xl bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-lg shadow-red-50 flex items-center justify-center gap-3 group"
                            >
                                <X size={24} className="group-hover:rotate-90 transition-transform" />
                                END SHIFT
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
