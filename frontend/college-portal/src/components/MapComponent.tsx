import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { MapPin, Crosshair } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaBusAlt } from 'react-icons/fa';

interface MapComponentProps {
    buses: any[];
    focusedLocation?: { lat: number, lng: number } | null;
    stopMarkers?: { lat: number, lng: number, name: string, isCompleted?: boolean }[];
    followBus?: boolean;
    path?: [number, number][]; // Array of [lat, lng] for drawing trip history
    selectedBusId?: string | null;
}

// Component to handle map re-centering with smooth animation
const ChangeView = ({ center, zoom, shouldAnimate = false }: { center: [number, number], zoom: number, shouldAnimate?: boolean }) => {
    const map = useMap();
    useEffect(() => {
        if (center[0] !== 0 && center[1] !== 0) {
            if (shouldAnimate) {
                map.flyTo(center, zoom, { duration: 1.5 });
            } else {
                map.setView(center, zoom);
            }
        }
    }, [center, zoom, map, shouldAnimate]);
    return null;
};

// Component to smoothly follow a bus location
const FollowBus = ({ position, enabled }: { position: [number, number] | null, enabled: boolean }) => {
    const map = useMap();
    const lastPanRef = useRef<number>(0);

    useEffect(() => {
        if (enabled && position && position[0] !== 0 && position[1] !== 0) {
            const now = Date.now();
            // Throttle panTo to avoid jarring movements, pan at most every 3 seconds
            if (now - lastPanRef.current > 3000) {
                map.panTo(position, { animate: true, duration: 1 });
                lastPanRef.current = now;
            }
        }
    }, [position, enabled, map]);

    return null;
};

// Component to get and update user location
const UserLocationMarker = ({ onLocationFound, shouldCenterOnUser }: { onLocationFound: (pos: [number, number]) => void, shouldCenterOnUser: boolean }) => {
    const [position, setPosition] = useState<[number, number] | null>(null);
    const [hasCenteredOnUser, setHasCenteredOnUser] = useState(false);
    const map = useMap();

    useEffect(() => {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            return;
        }

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const userPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setPosition(userPos);
                onLocationFound(userPos);

                if (shouldCenterOnUser && !hasCenteredOnUser) {
                    map.flyTo(userPos, 14, { duration: 1.5 });
                    setHasCenteredOnUser(true);
                }
            },
            (error) => {
                console.warn('Geolocation error:', error.message);
            },
            options
        );

        // Single position capture for student (no continuous watch)
        // watchPosition is avoided to conserve battery per spec
    }, []);

    useEffect(() => {
        if (shouldCenterOnUser && position && !hasCenteredOnUser) {
            map.flyTo(position, 14, { duration: 1.5 });
            setHasCenteredOnUser(true);
        }
    }, [shouldCenterOnUser, position, hasCenteredOnUser, map]);

    if (!position) return null;

    const userIconMarkup = renderToStaticMarkup(
        <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div>
            <div className="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>
        </div>
    );

    const userIcon = divIcon({
        html: userIconMarkup,
        className: 'user-location-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    return (
        <>
            <Circle
                center={position}
                radius={100}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
            />
            <Marker position={position} icon={userIcon}>
                <Popup>
                    <div className="text-center p-1">
                        <p className="font-bold text-blue-600">Your Location</p>
                        <p className="text-xs text-slate-500">{position[0].toFixed(6)}, {position[1].toFixed(6)}</p>
                    </div>
                </Popup>
            </Marker>
        </>
    );
};

// Bus Marker Component with Animation (5-Point Buffer Interpolation)
import { interpolatePosition, calculateBearing } from '../utils/mapUtils';

const AnimatedBusMarker = ({ bus, icon, onPositionUpdate }: { bus: any, icon: (bearing: number) => any, onPositionUpdate?: (busId: string, pos: [number, number], bearing: number) => void }) => {
    const [position, setPosition] = useState<[number, number]>([bus.location.latitude, bus.location.longitude]);
    const [bearing, setBearing] = useState<number>(bus.location.heading || 0);
    const animationFrameRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // Store latest buffer for animation loop access
    const bufferRef = useRef<any[]>([]);

    useEffect(() => {
        // Prepare buffer: Sort by timestamp
        const rawBuffer = bus.liveTrackBuffer || [];
        // Ensure we include current location as the absolute latest point
        const currentPoint = {
            latitude: bus.location.latitude,
            longitude: bus.location.longitude,
            heading: bus.location.heading,
            timestamp: bus.lastUpdated
        };

        // Merge and sort uniquely
        const combined = [...rawBuffer, currentPoint]
            .filter((v, i, a) => a.findIndex(t => t.timestamp === v.timestamp) === i) // Unique by timestamp
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Keep relevant history (last 5 points)
        bufferRef.current = combined.slice(-5);

        // Reset animation trigger
        startTimeRef.current = performance.now();

        const animate = (time: number) => {
            if (bufferRef.current.length < 2) {
                // Not enough history to interpolate, snap to latest
                setPosition([bus.location.latitude, bus.location.longitude]);
                return;
            }

            // Algorithm: 
            // We want to arrive at P_latest in 5 seconds (since updates come every 5s).
            // Actually, we are effectively 5 seconds BEHIND real-time to allow interpolation between known points.
            // But simpler approach: Interpolate from P_last_known to P_current over 5 seconds?
            // User requested: "Take last two points P4->P5 (5 sec apart) and produce interpolated positions"

            // Let's use the last two points for smooth movement
            const targetPoint = bufferRef.current[bufferRef.current.length - 1]; // P5 (Latest)
            const prevPoint = bufferRef.current[bufferRef.current.length - 2];   // P4 (Previous)

            if (!prevPoint || !targetPoint) return;

            const timeSinceUpdate = time - startTimeRef.current;
            const duration = 5000; // 5 seconds between updates

            if (timeSinceUpdate < duration) {
                const fraction = timeSinceUpdate / duration;

                // Interpolate Lat/Lng
                const interpolated = interpolatePosition(
                    { lat: prevPoint.latitude, lng: prevPoint.longitude },
                    { lat: targetPoint.latitude, lng: targetPoint.longitude },
                    fraction
                );

                setPosition([interpolated.lat, interpolated.lng]);

                // Update Bearing
                const newBearing = targetPoint.heading || calculateBearing(
                    { lat: prevPoint.latitude, lng: prevPoint.longitude },
                    { lat: targetPoint.latitude, lng: targetPoint.longitude }
                );
                setBearing(newBearing);

                // Notify parent for GPS pointer sync
                onPositionUpdate?.(bus._id, [interpolated.lat, interpolated.lng], newBearing);

                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Animation complete, snap to target
                setPosition([targetPoint.latitude, targetPoint.longitude]);
                setBearing(targetPoint.heading || bearing);
            }
        };

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [bus.lastUpdated, bus.liveTrackBuffer, bus.location]);

    return (
        // @ts-ignore
        <Marker position={position} icon={icon(bearing)}>
            <Popup>
                <div className="p-2 min-w-[150px]">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-2 text-sm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="18" rx="2" ry="2"></rect><line x1="5" y1="21" x2="5" y2="3"></line><line x1="19" y1="21" x2="19" y2="3"></line></svg>
                        {bus.busNumber}
                    </h3>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Status:</span>
                            <span className="font-bold px-2 py-0.5 rounded-full text-[10px]"
                                style={{
                                    backgroundColor: bus.status === 'ON_ROUTE' ? '#dcfce7' : '#f1f5f9',
                                    color: bus.status === 'ON_ROUTE' ? '#166534' : '#64748b'
                                }}>
                                {bus.status?.replace('_', ' ') || 'ACTIVE'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Speed:</span>
                            <span className="font-mono text-slate-700">{Math.round(bus.speed || 0)} mph</span>
                        </div>
                        {bus.currentRoadName && (
                            <div className="pt-1 border-t border-slate-50 mt-1">
                                <span className="text-[10px] text-slate-400 block uppercase font-bold mb-0.5">Current Road</span>
                                <span className="text-slate-700 font-medium leading-tight">{bus.currentRoadName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Popup>
        </Marker>
    );
};

const MapComponent = ({ buses, focusedLocation, stopMarkers = [], followBus: externalFollowBus, path, selectedBusId }: MapComponentProps) => { // Destructure path
    const [animatedPositions, setAnimatedPositions] = useState<{ [key: string]: { pos: [number, number], bearing: number } }>({});
    const props = { path }; // Keep props ref for use in logic above if needed

    const defaultCenter: [number, number] = [17.3850, 78.4867];
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [followBusEnabled, setFollowBusEnabled] = useState(externalFollowBus ?? true);

    // Track the active bus position for follow mode
    const selectedBus = selectedBusId ? buses.find(b => b._id === selectedBusId) : null;
    const activeBusWithLocation = selectedBus?.location?.latitude
        ? selectedBus
        : buses.find(b => b.status === 'ON_ROUTE' && b.location?.latitude && b.location?.longitude);

    const anyBusWithLocation = buses.find(b => b.location?.latitude && b.location?.longitude);

    // Use animated position if available, otherwise fallback to DB position
    const activeBusPosition: [number, number] | null = activeBusWithLocation
        ? (animatedPositions[activeBusWithLocation._id]?.pos ?? [activeBusWithLocation.location.latitude, activeBusWithLocation.location.longitude])
        : null;

    // Priority: Focused Location > Active bus > Any bus with location > Path start > User location > Default
    let mapCenter: [number, number] = defaultCenter;
    let shouldAnimate = false;
    let zoomLevel = 13;

    if (focusedLocation) {
        mapCenter = [focusedLocation.lat, focusedLocation.lng];
        shouldAnimate = true;
        zoomLevel = 15;
    } else if (activeBusWithLocation) {
        mapCenter = [activeBusWithLocation.location.latitude, activeBusWithLocation.location.longitude];
        shouldAnimate = false;
    } else if (anyBusWithLocation) {
        mapCenter = [anyBusWithLocation.location.latitude, anyBusWithLocation.location.longitude];
    } else if (props.path && props.path.length > 0) {
        // Center on the start of the path
        mapCenter = props.path[0];
        shouldAnimate = true;
    } else if (userLocation) {
        mapCenter = userLocation;
        zoomLevel = 14;
    }

    // Custom Bus Icon with heading rotation
    // Custom Bus Icon using FaBusAlt
    const createBusIcon = useCallback((status: string, heading?: number) => {
        const rotation = heading && !isNaN(heading) ? heading : 0;
        const color = status === 'ON_ROUTE' ? '#16a34a' : (status === 'MAINTENANCE' ? '#ea580c' : '#3b82f6');

        const iconMarkup = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                {/* Ping animation for live buses */}
                {status === 'ON_ROUTE' && (
                    <div className="absolute -inset-2 bg-green-500/30 rounded-full animate-ping"></div>
                )}

                <div className="relative z-10 filter drop-shadow-md text-3xl transition-all duration-500"
                    style={{
                        transform: `rotate(${rotation}deg)`,
                        color: color
                    }}>
                    <FaBusAlt />
                </div>
            </div>
        );

        return divIcon({
            html: iconMarkup,
            className: 'custom-bus-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        });
    }, []);

    // Create Pointer Icon (Selected Bus Highlights)
    const createPointerIcon = useCallback((bearing: number = 0) => {
        const iconMarkup = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <div className="absolute w-14 h-14 bg-blue-500/20 rounded-full animate-ping"></div>
                <div
                    className="relative z-10 text-blue-600 drop-shadow-xl text-4xl cursor-pointer"
                    style={{ transform: `rotate(${bearing}deg)` }}
                >
                    <FaBusAlt />
                </div>
            </div>
        );

        return divIcon({
            html: iconMarkup,
            className: 'gps-pointer-icon',
            iconSize: [56, 56],
            iconAnchor: [28, 28]
        });
    }, []);

    // Stop point icon
    const createStopIcon = useCallback((isCompleted: boolean = false) => {
        const color = isCompleted ? '#22c55e' : '#f59e0b'; // Green if completed, Amber otherwise
        const iconMarkup = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <div className="relative z-10 p-1 rounded-full shadow-md border-2 border-white text-white" style={{ backgroundColor: color }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {isCompleted ? (
                            <path d="M20 6L9 17l-5-5" />
                        ) : (
                            <>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </>
                        )}
                    </svg>
                </div>
            </div>
        );

        return divIcon({
            html: iconMarkup,
            className: 'custom-stop-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -16]
        });
    }, []);

    return (
        <div className="h-full w-full relative z-0">
            {buses.filter(b => b.location?.latitude).length === 0 && (
                <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 text-center max-w-xs mx-4">
                        <MapPin size={32} className="mx-auto text-slate-400 mb-2" />
                        <h4 className="font-bold text-slate-800">No Live Data</h4>
                        <p className="text-xs text-slate-500 mt-1">
                            Buses will appear on the map once drivers start their trips and share their live location.
                        </p>
                    </div>
                </div>
            )}

            {/* Follow Bus Toggle */}
            {activeBusWithLocation && !path && (
                <button
                    onClick={() => setFollowBusEnabled(prev => !prev)}
                    className={`absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all ${followBusEnabled
                        ? 'bg-blue-600 text-white shadow-blue-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    title={followBusEnabled ? 'Stop following bus' : 'Follow bus'}
                >
                    <Crosshair size={14} />
                    {followBusEnabled ? 'Following' : 'Follow Bus'}
                </button>
            )}

            <MapContainer
                center={mapCenter}
                zoom={zoomLevel}
                key={`${mapCenter[0]}-${mapCenter[1]}`} // Key change usage to force re-center if needed, or use ChangeView
                scrollWheelZoom={true}
                className="h-full w-full"
            >
                <ChangeView center={mapCenter} zoom={zoomLevel} shouldAnimate={shouldAnimate} />
                <FollowBus position={activeBusPosition} enabled={followBusEnabled && !focusedLocation && !path} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Trip History Path */}
                {path && path.length > 0 && (
                    <>
                        <Polyline
                            positions={path}
                            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7 }}
                        />
                        {/* Start Marker */}
                        <Marker position={path[0]} icon={createStopIcon()}>
                            <Popup>Start Point</Popup>
                        </Marker>
                        {/* End Marker */}
                        <Marker position={path[path.length - 1]} icon={createStopIcon()}>
                            <Popup>End Point</Popup>
                        </Marker>
                    </>
                )}

                {/* User location marker */}
                <UserLocationMarker
                    onLocationFound={setUserLocation}
                    shouldCenterOnUser={!activeBusWithLocation && !anyBusWithLocation}
                />

                {/* Bus markers with heading rotation */}
                {buses.map((bus) => {
                    if (bus.status !== 'ON_ROUTE' || bus.location?.latitude == null || bus.location?.longitude == null) return null;

                    return (
                        <AnimatedBusMarker
                            key={bus._id}
                            bus={bus}
                            icon={(bearing: number) => createBusIcon(bus.status, bearing)}
                            onPositionUpdate={(id, pos, bearing) => {
                                setAnimatedPositions(prev => ({
                                    ...prev,
                                    [id]: { pos, bearing }
                                }));
                            }}
                        />
                    );
                })}

                {/* GPS Pointer for Selected Bus */}
                {selectedBusId && buses.find(b => b._id === selectedBusId)?.location?.latitude && (
                    <Marker
                        position={animatedPositions[selectedBusId]?.pos ?? [
                            buses.find(b => b._id === selectedBusId)!.location.latitude,
                            buses.find(b => b._id === selectedBusId)!.location.longitude
                        ]}
                        icon={createPointerIcon(animatedPositions[selectedBusId]?.bearing ?? 0)}
                        zIndexOffset={1000}
                    />
                )}

                {/* Stop point markers */}
                {stopMarkers.map((stop, idx) => (
                    <Marker
                        key={`stop-${idx}`}
                        position={[stop.lat, stop.lng]}
                        icon={createStopIcon(stop.isCompleted)}
                    >
                        <Popup>
                            <div className="p-1 text-center">
                                <p className="font-bold text-slate-800 text-sm">{stop.name}</p>
                                <p className={`text-[10px] font-bold uppercase ${stop.isCompleted ? 'text-green-600' : 'text-amber-600'}`}>
                                    {stop.isCompleted ? 'Bus Reached' : 'Upcoming Stop'}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapComponent;
