import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import Map, { Source, Layer, Marker, type MapRef, NavigationControl, FullscreenControl, ScaleControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calculateBearing } from '../utils/mapUtils';
import { BsBusFront } from 'react-icons/bs';
import { FaBusAlt } from 'react-icons/fa';

interface MapLibreMapProps {
    buses: any[];
    focusedLocation?: { lat: number, lng: number } | null;
    stopMarkers?: { lat: number, lng: number, name: string, isCompleted?: boolean }[];
    followBus?: boolean;
    path?: [number, number][];
    selectedBusId?: string | null;
    routes?: any[];
    selectedRouteId?: string | null;
}

// 1. Universal Coordinate Normalizer (Fix 2 & Mismatch Fix)
export const getBusLatLng = (bus: any): [number, number] | null => {
    if (!bus || !bus.location) return null;

    // Check all possible field structures
    const lat = bus.location.latitude ?? bus.location.lat ?? bus.latitude;
    const lng = bus.location.longitude ?? bus.location.lng ?? bus.longitude;

    if (lat === undefined || lng === undefined) return null;

    // Always return MapLibre standard [lng, lat]
    return [lng, lat];
};

const MapLibreMap = ({ buses, focusedLocation, followBus: externalFollowBus, path, selectedBusId, routes, selectedRouteId }: MapLibreMapProps) => {
    const mapRef = useRef<MapRef | null>(null);

    // Type definition for DOM Marker State
    const markersRef = useRef<{ [key: string]: { marker: maplibregl.Marker, root: ReturnType<typeof createRoot> } }>({});

    // Animation Refs for high-performance updates
    const animatedPositionsRef = useRef<{ [key: string]: { pos: [number, number], bearing: number } }>({});
    const animationFrameRef = useRef<number | null>(null);

    const defaultCenter: [number, number] = [78.4867, 17.3850];
    const [followBusEnabled] = useState(externalFollowBus ?? true);

    const selectedBus = useMemo(() => selectedBusId ? buses.find(b => b._id === selectedBusId) : null, [buses, selectedBusId]);

    // Inclusive Tracking: Support any bus with location (Fix 1)
    const activeBusWithLocation = useMemo(() => {
        if (selectedBus && getBusLatLng(selectedBus)) return selectedBus;
        return buses.find(b => getBusLatLng(b));
    }, [buses, selectedBus]);

    // Initial View State
    const initialViewState = useMemo(() => {
        let center = defaultCenter;
        let zoom = 13;

        if (focusedLocation) {
            center = getBusLatLng({ location: focusedLocation }) || defaultCenter;
            zoom = 17;
        } else if (activeBusWithLocation) {
            center = getBusLatLng(activeBusWithLocation) || defaultCenter;
            zoom = 17;
        }

        return {
            longitude: center[0],
            latitude: center[1],
            zoom,
            pitch: 0,
            bearing: 0
        };
    }, []);

    // Patch existing style to make roads more visible and remove 3D buildings
    const ensureResources = useCallback((map: any) => {
        if (!map.isStyleLoaded()) return;

        const layers = map.getStyle().layers;
        if (layers) {
            layers.forEach((l: any) => {
                if (l.type === 'line' && l.id) {
                    const id = l.id.toLowerCase();
                    if (id.includes('road') || id.includes('street') || id.includes('transport')) {
                        // Increase opacity to ensure minor roads are visible
                        try {
                            map.setPaintProperty(l.id, 'line-opacity', 0.9);
                        } catch (e) {
                            // Ignore if property is entirely data-driven and can't be easily overridden
                        }
                    }
                }
            });
        }
    }, []);

    const onStyleData = useCallback((e: any) => ensureResources(e.target), [ensureResources]);
    const onLoad = useCallback((e: any) => ensureResources(e.target), [ensureResources]);

    // --- DOM Marker Management (Option A & Fix Icon Missing) ---
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        buses.forEach(bus => {
            const latLng = getBusLatLng(bus);
            if (!latLng) return;

            let markerState = markersRef.current[bus._id];

            if (!markerState) {
                const el = document.createElement('div');
                el.className = 'bus-dom-marker cursor-pointer relative flex items-center justify-center';

                const root = createRoot(el);
                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat(latLng)
                    .addTo(map);

                markerState = { marker, root };
                markersRef.current[bus._id] = markerState;
            }

            let color = '#16a34a';
            if (bus.status === 'MAINTENANCE') color = '#ea580c';
            else if (bus.status === 'ACTIVE' || bus.status.includes('Offline')) color = '#64748b';

            // React guarantees fast targeted updates to this specific DOM portal
            markerState.root.render(
                <div className="relative flex items-center justify-center drop-shadow-md transition-transform hover:scale-110 group">
                    {selectedBusId === bus._id && (
                        <div className="absolute w-14 h-14 bg-dashboard-primary/20 rounded-full animate-pulse" />
                    )}
                    <BsBusFront
                        color={color}
                        size={32}
                        className="bus-icon-svg relative z-10 transition-transform duration-200"
                        style={{ transform: `rotate(${bus.location?.heading || 0}deg)` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute top-10 whitespace-nowrap bg-dashboard-surface text-dashboard-text border border-dashboard-border shadow-soft text-[11px] font-bold px-3 py-1.5 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span>Bus {bus.busNumber || 'Unknown'} • {bus.driverName || 'No Driver'}</span>
                            {bus.status === 'ON_ROUTE' && typeof bus.speed === 'number' && (
                                <span className="text-dashboard-primary">{Math.round(bus.speed)} mph</span>
                            )}
                        </div>
                        {bus.routeName && <span className="text-[10px] text-dashboard-muted font-medium">{bus.routeName}</span>}
                    </div>
                </div>
            );

            // Sync stationary bus immediately
            if (bus.status !== 'ON_ROUTE') {
                markerState.marker.setLngLat(latLng);
                const iconEl = markerState.marker.getElement().querySelector('.bus-icon-svg') as HTMLElement;
                if (iconEl) iconEl.style.transform = `rotate(${bus.location?.heading || 0}deg)`;
            }
        });

        // Cleanup removed buses
        Object.keys(markersRef.current).forEach(id => {
            if (!buses.find(b => b._id === id)) {
                markersRef.current[id].marker.remove();
                markersRef.current[id].root.unmount();
                delete markersRef.current[id];
            }
        });
    }, [buses, selectedBusId]);

    // --- Fast Animation Engine ---
    useEffect(() => {
        const busesWithLoc = buses.filter(b => getBusLatLng(b));
        if (busesWithLoc.length === 0) return;

        const animate = (_time: number) => {
            busesWithLoc.forEach(bus => {
                const rawBuffer = bus.liveTrackBuffer || [];
                const latLng = getBusLatLng(bus)!;

                const currentPoint = {
                    latitude: latLng[1],
                    longitude: latLng[0],
                    heading: bus.location?.heading || 0,
                    timestamp: bus.lastUpdated
                };

                const combined = [...rawBuffer, currentPoint]
                    .filter((v, i, a) => a.findIndex(t => t.timestamp === v.timestamp) === i)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .slice(-5);

                if (bus.status !== 'ON_ROUTE' || combined.length < 2) {
                    animatedPositionsRef.current[bus._id] = { pos: latLng, bearing: bus.location?.heading || 0 };
                    return;
                }

                const targetPoint = combined[combined.length - 1];
                const prevPoint = combined[combined.length - 2];
                const targetLatLng = getBusLatLng({ location: targetPoint }) || latLng;
                const prevLatLng = getBusLatLng({ location: prevPoint }) || latLng;

                const currentAnimated = animatedPositionsRef.current[bus._id];
                if (!currentAnimated) {
                    animatedPositionsRef.current[bus._id] = { pos: prevLatLng, bearing: targetPoint.heading || 0 };
                } else {
                    const dx = targetLatLng[0] - currentAnimated.pos[0];
                    const dy = targetLatLng[1] - currentAnimated.pos[1];
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0.00001) {
                        currentAnimated.pos[0] += dx * 0.05;
                        currentAnimated.pos[1] += dy * 0.05;
                        currentAnimated.bearing = targetPoint.heading ?? calculateBearing(
                            { lat: currentAnimated.pos[1], lng: currentAnimated.pos[0] },
                            { lat: targetLatLng[1], lng: targetLatLng[0] }
                        );
                    } else {
                        currentAnimated.pos = targetLatLng;
                    }
                }

                const markerData = markersRef.current[bus._id];
                if (markerData?.marker) {
                    markerData.marker.setLngLat(currentAnimated.pos);
                    const iconEl = markerData.marker.getElement().querySelector('.bus-icon-svg') as HTMLElement;
                    if (iconEl) iconEl.style.transform = `rotate(${currentAnimated.bearing}deg)`;
                }
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [buses]);

    // Follow Mode (Camera Tracking logic)
    useEffect(() => {
        if (followBusEnabled && activeBusWithLocation && mapRef.current) {
            const animated = animatedPositionsRef.current[activeBusWithLocation._id];
            const center = animated ? animated.pos : getBusLatLng(activeBusWithLocation);
            if (center) mapRef.current.panTo(center, { duration: 800 });
        }
    }, [followBusEnabled, activeBusWithLocation]);

    // Selection Camera Logic
    useEffect(() => {
        if (mapRef.current) {
            if (focusedLocation) {
                const latLng = getBusLatLng({ location: focusedLocation });
                if (latLng) mapRef.current.flyTo({ center: latLng, zoom: 17, pitch: 0, bearing: 0, duration: 1200 });
            } else if (getBusLatLng(selectedBus)) {
                mapRef.current.flyTo({ center: getBusLatLng(selectedBus)!, zoom: 17, pitch: 0, bearing: 0, duration: 1000 });
            }
        }
    }, [focusedLocation, selectedBusId]);

    const isMissingData = buses.filter(b => getBusLatLng(b)).length === 0;

    return (
        <div className="h-full w-full relative z-0 bg-slate-50 overflow-hidden rounded-2xl border border-slate-200">
            {isMissingData && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                    <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-100 text-center max-w-xs mx-4">
                        <div className="flex justify-center mb-3"><FaBusAlt className="text-blue-500/30 text-4xl" /></div>
                        <h4 className="font-bold text-slate-800">Fleet Monitoring Idle</h4>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium">No active GPS feeds. Locations will appear on trip start.</p>
                    </div>
                </div>
            )}

            {/* Selection Overlay (Fix 5) */}
            {selectedBus && (
                <div className="absolute top-4 left-4 z-20 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-slate-200/50 flex flex-col gap-1 min-w-[220px]">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black text-slate-400 tracking-wider">MAP VIEW</span>
                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${selectedBus.location?.latitude ? (selectedBus.status === 'ON_ROUTE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700') : 'bg-red-100 text-red-700'
                                }`}>
                                {selectedBus.location?.latitude ? (selectedBus.status === 'ON_ROUTE' ? 'LIVE' : 'IDLE') : 'NO DATA'}
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-800">Bus {selectedBus.busNumber}</h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                            {!selectedBus.location?.latitude
                                ? 'No location coordinates received yet.'
                                : (selectedBus.status === 'ON_ROUTE' ? 'Tracking real-time movement' : 'Pinned at last known location')}
                        </p>
                    </div>
                </div>
            )}

            <Map
                ref={mapRef}
                initialViewState={initialViewState}
                mapStyle={import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"}
                onStyleData={onStyleData}
                onLoad={onLoad}
                style={{ width: '100%', height: '100%' }}
                padding={{ top: 80, bottom: 80, left: 80, right: 80 }}
                dragRotate={false}
                pitchWithRotate={false}
            >
                <NavigationControl position="bottom-right" showCompass={false} />
                <FullscreenControl position="top-right" />
                <ScaleControl position="bottom-left" />

                {/* Legacy simple path for TripHistory */}
                {path && path.length > 0 && (
                    <>
                        <Source id="trip-path-legacy" type="geojson" data={{
                            type: "Feature",
                            geometry: { type: "LineString", coordinates: path.map(p => [p[1], p[0]]) },
                            properties: {}
                        }}>
                            <Layer
                                id="trip-path-line-legacy"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 }}
                            />
                            <Layer
                                id="trip-path-dir-legacy"
                                type="symbol"
                                layout={{
                                    'symbol-placement': 'line',
                                    'symbol-spacing': 100,
                                    'text-field': '▶',
                                    'text-size': 14,
                                    'text-keep-upright': false,
                                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
                                }}
                                paint={{
                                    'text-color': '#1d4ed8',
                                    'text-halo-color': '#ffffff',
                                    'text-halo-width': 1.5
                                }}
                            />
                        </Source>
                        
                        {/* Start Node */}
                        <Marker longitude={path[0][1]} latitude={path[0][0]} anchor="center">
                            <div className="bg-green-500 border-2 border-white w-4 h-4 rounded-full shadow-md" title="Start Point" />
                        </Marker>

                        {/* End Node */}
                        {path.length > 1 && (
                            <Marker longitude={path[path.length - 1][1]} latitude={path[path.length - 1][0]} anchor="center">
                                <div className="bg-red-500 border-2 border-white w-4 h-4 rounded-full shadow-md z-10" title="End Point" />
                            </Marker>
                        )}
                    </>
                )}

                {/* Route Polylines */}
                {routes && routes.map(route => {
                    if (!route.stops || route.stops.length < 2) return null;
                    const coords = route.stops
                        .filter((s: any) => s.longitude !== undefined && s.latitude !== undefined)
                        .map((s: any) => [s.longitude, s.latitude]);
                        
                    if (coords.length < 2) return null;
                    const isSelected = route._id === selectedRouteId;
                    
                    return (
                        <Source key={`route-${route._id}`} id={`route-source-${route._id}`} type="geojson" data={{
                            type: "Feature",
                            geometry: { type: "LineString", coordinates: coords },
                            properties: {}
                        }}>
                            <Layer
                                id={`route-layer-${route._id}`}
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{ 
                                    'line-color': isSelected ? '#FF8A3D' : '#374151', 
                                    'line-width': isSelected ? 5 : 2.5, 
                                    'line-opacity': isSelected ? 1 : 0.6 
                                }}
                            />
                        </Source>
                    );
                })}

                {/* Stop Markers for Selected Route */}
                {routes && selectedRouteId && routes.find(r => r._id === selectedRouteId)?.stops?.map((stop: any, idx: number) => {
                    if (stop.longitude === undefined || stop.latitude === undefined) return null;
                    return (
                        <Marker key={`stop-${idx}`} longitude={stop.longitude} latitude={stop.latitude} anchor="center">
                            <div className="bg-white border-2 border-[#1F2A37] text-[#1F2A37] text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md">
                                {idx + 1}
                            </div>
                        </Marker>
                    );
                })}
            </Map>
        </div>
    );
};

export default MapLibreMap;
