import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navigation, LogOut, AlertCircle } from 'lucide-react';
import { getDriverBuses, updateBusLocation } from '../services/api';

const DriverDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();

    // State
    const [buses, setBuses] = useState<any[]>([]);
    const [selectedBusId, setSelectedBusId] = useState<string>('');
    const [isTracking, setIsTracking] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [currentSpeed, setCurrentSpeed] = useState<number>(0);
    const [locationPermission, setLocationPermission] = useState<PermissionState>('prompt');

    // Refs for tracking
    const watchIdRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);

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
                } else {
                    console.warn("Failed to fetch buses:", response.message);
                }
            } catch (err) {
                console.error("Failed to init driver dashboard", err);
            }
        };
        init();
    }, []);

    // 2. Start Tracking Loop
    const startTrip = async () => {
        if (!selectedBusId) return;
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }

        setIsTracking(true);
        setLocationError(null);

        // Update status to ON_ROUTE immediately
        await updateBusStatus('ON_ROUTE');

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                // Throttle updates to every 3 seconds to save bandwidth/db writes
                if (now - lastUpdateRef.current > 3000) {
                    const { latitude, longitude, speed, heading } = position.coords;

                    setCurrentSpeed((speed || 0) * 3.6); // Convert m/s to km/h

                    try {
                        await updateBusLocation(selectedBusId, {
                            latitude,
                            longitude,
                            speed: Math.round((speed || 0) * 3.6),
                            heading: heading || 0,
                            status: 'ON_ROUTE'
                        });
                        lastUpdateRef.current = now;
                    } catch (err) {
                        console.error("Failed to send location update", err);
                    }
                }
            },
            (error) => {
                console.error("Location Error:", error);
                setLocationError(error.message);
                // Don't stop tracking automatically on transient errors, but warn user
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
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
        setCurrentSpeed(0);

        // Reset bus status
        await updateBusStatus('ACTIVE');
    };

    const updateBusStatus = async (status: string) => {
        if (!selectedBusId) return;
        try {
            await updateBusLocation(selectedBusId, {
                // Send current location if we have it, mostly simply status update
                status,
                speed: 0
            } as any);
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    const handleLogout = () => {
        endTrip(); // Ensure tracking stops
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('current_college_id');
        localStorage.removeItem('orgName');
        navigate(`/${orgSlug}/login`);
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
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <div className="bg-blue-800 text-white p-4 shadow-md flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <Navigation />
                    <h1 className="font-bold text-lg">Driver App</h1>
                </div>
                <button onClick={handleLogout} className="text-white/80 hover:text-white">
                    <LogOut size={20} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 flex flex-col gap-4 max-w-md mx-auto w-full">

                {/* Status Card */}
                <div className={`rounded-2xl p-6 text-center shadow-lg transition-all ${isTracking ? 'bg-green-600 text-white' : 'bg-white text-slate-800'
                    }`}>
                    <div className="mb-2 uppercase text-xs font-bold tracking-wider opacity-80">
                        Current Status
                    </div>
                    <div className="text-2xl font-bold flex items-center justify-center gap-2">
                        {isTracking ? (
                            <>
                                <span className="animate-pulse w-3 h-3 rounded-full bg-white"></span>
                                ON TRIP
                            </>
                        ) : 'IDLE'}
                    </div>
                    {isTracking && (
                        <div className="mt-4 text-6xl font-black">
                            {Math.round(currentSpeed)} <span className="text-lg font-medium opacity-70">km/h</span>
                        </div>
                    )}
                </div>

                {locationError && (
                    <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        {locationError}
                    </div>
                )}

                {/* Controls */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
                    {!isTracking ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Select Your Bus</label>
                                {buses.length === 0 ? (
                                    <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                        No buses available for this college.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {buses.map(bus => (
                                            <button
                                                key={bus._id}
                                                onClick={() => setSelectedBusId(bus._id)}
                                                className={`p-3 rounded-xl border text-left transition-all ${selectedBusId === bus._id
                                                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-slate-200 hover:border-blue-300'
                                                    }`}
                                            >
                                                <div className="font-bold text-slate-800">{bus.busNumber}</div>
                                                <div className="text-xs text-slate-500 truncate">{bus.routeName || 'No Route'}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={startTrip}
                                disabled={!selectedBusId}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 ${selectedBusId
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform active:scale-95'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                <Navigation size={24} />
                                Start Trip
                            </button>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="text-sm text-slate-500">Driving Bus</div>
                                <div className="font-bold text-xl text-slate-800">
                                    {buses.find(b => b._id === selectedBusId)?.busNumber}
                                </div>
                            </div>

                            <button
                                onClick={endTrip}
                                className="w-full py-4 rounded-xl font-bold text-lg bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 hover:shadow-md transition-all flex items-center justify-center gap-2 transform active:scale-95"
                            >
                                <LogOut size={24} />
                                End Trip
                            </button>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="text-center text-xs text-slate-400 mt-4 px-4">
                    Keep this screen open while driving to ensure location updates are sent.
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
