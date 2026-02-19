import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { MapPin, Crosshair } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

interface MapComponentProps {
    buses: any[];
    focusedLocation?: { lat: number, lng: number } | null;
    stopMarkers?: { lat: number, lng: number, name: string, isCompleted?: boolean }[];
    followBus?: boolean;
    path?: [number, number][]; // Array of [lat, lng] for drawing trip history
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

// Bus Marker Component with Animation
const AnimatedBusMarker = ({ bus, icon }: { bus: any, icon: any }) => {
    const [position, setPosition] = useState<[number, number]>([bus.location.latitude, bus.location.longitude]);
    const trailRef = useRef<any[]>([]);
    const animationRef = useRef<number | undefined>(undefined);

    // Update position when bus updates
    useEffect(() => {
        if (bus.liveTrail && Array.isArray(bus.liveTrail) && bus.liveTrail.length > 0) {
            // Sort trail by timestamp
            const sortedTrail = [...bus.liveTrail].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Add current location as final point
            sortedTrail.push({
                lat: bus.location.latitude,
                lng: bus.location.longitude,
                timestamp: bus.lastUpdated
            });

            trailRef.current = sortedTrail;

            // Start animation
            let startTime = performance.now();
            const durationPerSegment = 1000; // 1s per segment since we capture at 1s intervals

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const totalDuration = (trailRef.current.length - 1) * durationPerSegment;

                if (elapsed < totalDuration) {
                    const segmentIndex = Math.floor(elapsed / durationPerSegment);
                    const segmentProgress = (elapsed % durationPerSegment) / durationPerSegment;

                    const startPoint = trailRef.current[segmentIndex];
                    const endPoint = trailRef.current[segmentIndex + 1];

                    if (startPoint && endPoint) {
                        const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * segmentProgress;
                        const lng = startPoint.lng + (endPoint.lng - startPoint.lng) * segmentProgress;
                        setPosition([lat, lng]);
                    }

                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    setPosition([bus.location.latitude, bus.location.longitude]);
                }
            };

            cancelAnimationFrame(animationRef.current!);
            animationRef.current = requestAnimationFrame(animate);

        } else {
            setPosition([bus.location.latitude, bus.location.longitude]);
        }

        return () => cancelAnimationFrame(animationRef.current!);
    }, [bus.lastUpdated, bus.liveTrail, bus.location]);

    return (
        <Marker position={position} icon={icon}>
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
                                    backgroundColor: bus.status === 'ON_ROUTE' ? '#dcfce7' : '#eff6ff',
                                    color: bus.status === 'ON_ROUTE' ? '#16a34a' : '#3b82f6'
                                }}>
                                {bus.status === 'ON_ROUTE' ? 'MOVING' : 'IDLE'}
                            </span>
                        </div>
                        {bus.speed != null && (
                            <div className="flex justify-between items-center bg-slate-50 p-1 rounded">
                                <span className="text-slate-500">Speed:</span>
                                <span className="font-mono font-bold text-slate-700">{bus.speed} km/h</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center bg-blue-50 p-1 rounded border border-blue-100">
                            <span className="text-blue-500 font-medium">Updated:</span>
                            <span className="font-mono font-bold text-blue-700">
                                {bus.lastUpdated ? new Date(bus.lastUpdated).toLocaleTimeString() : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
};

const MapComponent = ({ buses, focusedLocation, stopMarkers = [], followBus: externalFollowBus, path }: MapComponentProps) => { // Destructure path
    const props = { path }; // Keep props ref for use in logic above if needed

    const defaultCenter: [number, number] = [17.3850, 78.4867];
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [followBusEnabled, setFollowBusEnabled] = useState(externalFollowBus ?? true);

    // Track the active bus position for follow mode
    const activeBusWithLocation = buses.find(b => b.status === 'ON_ROUTE' && b.location?.latitude && b.location?.longitude);
    const anyBusWithLocation = buses.find(b => b.location?.latitude && b.location?.longitude);

    const activeBusPosition: [number, number] | null = activeBusWithLocation
        ? [activeBusWithLocation.location.latitude, activeBusWithLocation.location.longitude]
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
    const createBusIcon = useCallback((status: string, heading?: number) => {
        const color = status === 'ON_ROUTE' ? '#16a34a' : (status === 'MAINTENANCE' ? '#ea580c' : '#3b82f6');
        const rotation = heading && !isNaN(heading) ? heading : 0;

        const iconMarkup = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <div className={`absolute -inset-1 rounded-full opacity-50 ${status === 'ON_ROUTE' ? 'animate-pulse' : ''}`} style={{ backgroundColor: color }}></div>
                <div
                    className="relative z-10 p-1.5 rounded-full shadow-lg border-2 border-white text-white"
                    style={{
                        backgroundColor: color,
                        transform: `rotate(${rotation}deg)`,
                        transition: 'transform 0.5s ease'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L4 22l8-6 8 6z" fill="currentColor" opacity="0.3" />
                        <path d="M12 2L4 22l8-6 8 6z" />
                    </svg>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style={{ borderTopColor: color }}></div>
            </div>
        );

        return divIcon({
            html: iconMarkup,
            className: 'custom-bus-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
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

                    const heading = bus.heading || bus.currentHeading || 0;

                    return (
                        <AnimatedBusMarker
                            key={bus._id}
                            bus={bus}
                            icon={createBusIcon(bus.status, heading)}
                        />
                    );
                })}

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
