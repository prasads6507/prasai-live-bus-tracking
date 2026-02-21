import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Map, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calculateBearing } from '../utils/mapUtils';
import { FaBusAlt } from 'react-icons/fa';

interface MapLibreMapProps {
    buses: any[];
    focusedLocation?: { lat: number, lng: number } | null;
    stopMarkers?: { lat: number, lng: number, name: string, isCompleted?: boolean }[];
    followBus?: boolean;
    path?: [number, number][]; // Array of [lat, lng] for drawing trip history
    selectedBusId?: string | null;
}

// Helper to create an SVG data URI for MapLibre image loading
const createBusSvgUri = (color: string) => {
    const svgStr = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 44 44" width="40" height="40">
            <g font-size="24" fill="${color}" stroke="white" stroke-width="1.5">
                <path d="M4 6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v10H4V6zm0 10v4c0 .6.4 1 1 1h14c.6 0 1-.4 1-1v-4H4zm3 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </g>
        </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
};

const createPointerSvgUri = () => {
    const svgStr = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 64 64" width="56" height="56">
            <circle cx="12" cy="12" r="28" fill="rgba(59, 130, 246, 0.2)" />
            <g font-size="24" fill="#2563eb" filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.3))">
               <path d="M4 6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v10H4V6zm0 10v4c0 .6.4 1 1 1h14c.6 0 1-.4 1-1v-4H4zm3 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </g>
        </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
};

const MapLibreMap = ({ buses, focusedLocation, followBus: externalFollowBus, path, selectedBusId }: MapLibreMapProps) => {
    const mapRef = useRef<MapRef | null>(null);
    const [imagesLoaded, setImagesLoaded] = useState(false);

    // Animation Refs
    const animatedPositionsRef = useRef<{ [key: string]: { pos: [number, number], bearing: number } }>({});
    const animationFrameRef = useRef<number | null>(null);
    const [triggerRender, setTriggerRender] = useState(0); // For forcing UI updates for popups/pure state

    const defaultCenter: [number, number] = [78.4867, 17.3850]; // [lng, lat]
    const [userLocation] = useState<[number, number] | null>(null);
    const [followBusEnabled] = useState(externalFollowBus ?? true);

    const selectedBus = selectedBusId ? buses.find(b => b._id === selectedBusId) : null;
    const activeBusWithLocation = selectedBus?.location?.latitude
        ? selectedBus
        : buses.find(b => b.status === 'ON_ROUTE' && b.location?.latitude && b.location?.longitude);

    // Initial View State
    const initialViewState = useMemo(() => {
        let center = defaultCenter;
        let zoom = 13;

        if (focusedLocation) {
            center = [focusedLocation.lng, focusedLocation.lat];
            zoom = 15;
        } else if (activeBusWithLocation) {
            center = [activeBusWithLocation.location.longitude, activeBusWithLocation.location.latitude];
        } else if (path && path.length > 0) {
            center = [path[0][1], path[0][0]];
        } else if (userLocation) {
            center = userLocation;
            zoom = 14;
        }

        return {
            longitude: center[0],
            latitude: center[1],
            zoom
        };
    }, []);

    // Handle Map Load & Images
    const onMapLoad = useCallback((e: any) => {
        const map = e.target;

        // Load icons
        map.loadImage(createBusSvgUri('#16a34a'), (error: any, image: any) => {
            if (error) throw error;
            if (!map.hasImage('bus-icon-active')) map.addImage('bus-icon-active', image);

            map.loadImage(createBusSvgUri('#ea580c'), (error2: any, image2: any) => {
                if (error2) throw error2;
                if (!map.hasImage('bus-icon-maintenance')) map.addImage('bus-icon-maintenance', image2);

                map.loadImage(createPointerSvgUri(), (error3: any, image3: any) => {
                    if (error3) throw error3;
                    if (!map.hasImage('pointer-icon')) map.addImage('pointer-icon', image3);
                    setImagesLoaded(true);
                });
            });
        });
    }, []);

    // --- Animation Loop ---
    useEffect(() => {
        const activeBuses = buses.filter(b => b.status === 'ON_ROUTE' && b.location?.latitude);
        if (activeBuses.length === 0) return;

        const animate = (_time: number) => {
            let needsRender = false;

            activeBuses.forEach(bus => {
                const rawBuffer = bus.liveTrackBuffer || [];
                const currentPoint = {
                    latitude: bus.location.latitude,
                    longitude: bus.location.longitude,
                    heading: bus.location.heading,
                    timestamp: bus.lastUpdated
                };

                const combined = [...rawBuffer, currentPoint]
                    .filter((v, i, a) => a.findIndex(t => t.timestamp === v.timestamp) === i)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .slice(-5);

                if (combined.length < 2) {
                    // Snap
                    animatedPositionsRef.current[bus._id] = {
                        pos: [bus.location.longitude, bus.location.latitude],
                        bearing: bus.location.heading || 0
                    };
                    needsRender = true;
                    return;
                }

                const targetPoint = combined[combined.length - 1]; // P5 (Latest)
                const prevPoint = combined[combined.length - 2];   // P4 (Previous)

                // Fake a start time implicitly if we don't have one per bus, 
                // but robust animation needs a start time mapped to the segment.
                // For simplicity matching the Leaflet logic, we'll assume the interpolation corresponds to ~5s total duration 
                // between updates.

                // Without complex per-bus time tracking, we'll snap non-selected buses and only aggressively interpolate selected.
                // Optimization: Only animate selectedBusId if it exists to save CPU.
                if (selectedBusId && bus._id !== selectedBusId) {
                    animatedPositionsRef.current[bus._id] = {
                        pos: [targetPoint.longitude, targetPoint.latitude],
                        bearing: targetPoint.heading || 0
                    };
                    return;
                }

                // If it is the selected bus, or no selected bus exists, we animate roughly based on time since targetPoint arrived
                // Using a simpler approach for MapLibre: just keep them moving slowly towards target if not there

                const currentAnimated = animatedPositionsRef.current[bus._id];
                if (!currentAnimated) {
                    animatedPositionsRef.current[bus._id] = {
                        pos: [prevPoint.longitude, prevPoint.latitude],
                        bearing: targetPoint.heading || 0
                    };
                } else {
                    // Primitive easing towards target
                    const dx = targetPoint.longitude - currentAnimated.pos[0];
                    const dy = targetPoint.latitude - currentAnimated.pos[1];
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0.00001) {
                        currentAnimated.pos[0] += dx * 0.05; // 5% per frame (60fps = ~1.2s to reach)
                        currentAnimated.pos[1] += dy * 0.05;
                        currentAnimated.bearing = targetPoint.heading ?? calculateBearing(
                            { lat: currentAnimated.pos[1], lng: currentAnimated.pos[0] },
                            { lat: targetPoint.latitude, lng: targetPoint.longitude }
                        );
                        needsRender = true;
                    } else {
                        currentAnimated.pos = [targetPoint.longitude, targetPoint.latitude];
                    }
                }
            });

            if (needsRender) {
                setTriggerRender(prev => prev + 1); // trigger state update for Sources
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [buses, selectedBusId]);


    // Data Sources
    const geojsonData = useMemo(() => {
        return {
            type: "FeatureCollection" as const,
            features: buses.map(bus => {
                if (!bus.location?.latitude) return null;
                const animated = animatedPositionsRef.current[bus._id];
                const lng = animated ? animated.pos[0] : bus.location.longitude;
                const lat = animated ? animated.pos[1] : bus.location.latitude;
                const heading = animated ? animated.bearing : (bus.location.heading || 0);

                return {
                    type: "Feature" as const,
                    geometry: { type: "Point" as const, coordinates: [lng, lat] },
                    properties: {
                        id: bus._id,
                        busNumber: bus.busNumber,
                        status: bus.status,
                        heading: heading,
                        icon: bus.status === 'MAINTENANCE' ? 'bus-icon-maintenance' : 'bus-icon-active'
                    }
                };
            }).filter(Boolean) as any[]
        };
    }, [buses, triggerRender]); // Recompute when buses change or animation ticks

    const pointerData = useMemo(() => {
        if (!selectedBusId) return null;
        const animated = animatedPositionsRef.current[selectedBusId];
        const selectedBus = buses.find(b => b._id === selectedBusId);

        if (!animated && !selectedBus?.location?.latitude) return null;

        const lng = animated ? animated.pos[0] : selectedBus!.location.longitude;
        const lat = animated ? animated.pos[1] : selectedBus!.location.latitude;
        const heading = animated ? animated.bearing : (selectedBus!.location.heading || 0);

        return {
            type: "FeatureCollection" as const,
            features: [{
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: [lng, lat] },
                properties: { heading }
            }]
        };
    }, [selectedBusId, triggerRender]);

    // Follow Bus Logic
    useEffect(() => {
        if (followBusEnabled && activeBusWithLocation && mapRef.current) {
            const animated = animatedPositionsRef.current[activeBusWithLocation._id];
            const lng = animated ? animated.pos[0] : activeBusWithLocation.location.longitude;
            const lat = animated ? animated.pos[1] : activeBusWithLocation.location.latitude;

            mapRef.current.panTo([lng, lat], { duration: 1000 });
        }
    }, [triggerRender, followBusEnabled]); // Tie to render tick for smoothness if following

    // Focused Location override
    useEffect(() => {
        if (focusedLocation && mapRef.current) {
            mapRef.current.flyTo({ center: [focusedLocation.lng, focusedLocation.lat], zoom: 15, duration: 1500 });
        }
    }, [focusedLocation]);

    const isMissingData = buses.filter(b => b.location?.latitude).length === 0;

    return (
        <div className="h-full w-full relative z-0">
            {isMissingData && (
                <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                    <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 text-center max-w-xs mx-4">
                        <div className="flex justify-center mb-2"><FaBusAlt className="text-slate-400 text-3xl" /></div>
                        <h4 className="font-bold text-slate-800">No Live Data</h4>
                        <p className="text-xs text-slate-500 mt-1">
                            Buses will appear on the map once drivers start trips.
                        </p>
                    </div>
                </div>
            )}

            <Map
                ref={mapRef}
                initialViewState={initialViewState}
                mapStyle={import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"}
                pitchWithRotate={false}
                dragRotate={false}
                onLoad={onMapLoad}
                style={{ width: '100%', height: '100%' }}
            >
                {/* Trip Path (Optional) - Keeping it simple for MapLibre if path is present */}
                {path && path.length > 0 && (
                    <Source id="trip-path" type="geojson" data={{
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: path.map(p => [p[1], p[0]]) }, // Leaflet is lat,lng -> maplibre lng,lat
                        properties: {}
                    }}>
                        <Layer
                            id="trip-path-line"
                            type="line"
                            paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.7 }}
                        />
                    </Source>
                )}

                {imagesLoaded && (
                    <>
                        <Source id="buses" type="geojson" data={geojsonData}>
                            <Layer
                                id="buses-layer"
                                type="symbol"
                                layout={{
                                    'icon-image': ['get', 'icon'],
                                    'icon-size': 1,
                                    'icon-rotate': ['get', 'heading'],
                                    'icon-allow-overlap': true,
                                    'icon-rotation-alignment': 'map'
                                }}
                            />
                        </Source>

                        {pointerData && (
                            <Source id="selected-pointer" type="geojson" data={pointerData}>
                                <Layer
                                    id="pointer-layer"
                                    type="symbol"
                                    layout={{
                                        'icon-image': 'pointer-icon',
                                        'icon-size': 1,
                                        'icon-rotate': ['get', 'heading'],
                                        'icon-allow-overlap': true,
                                        'icon-ignore-placement': true,
                                        'icon-rotation-alignment': 'map'
                                    }}
                                />
                            </Source>
                        )}
                    </>
                )}
            </Map>
        </div>
    );
};

export default MapLibreMap;
