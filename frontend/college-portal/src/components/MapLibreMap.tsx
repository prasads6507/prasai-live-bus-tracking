import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import Map, { Source, Layer, Marker, type MapRef, NavigationControl, FullscreenControl, ScaleControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calculateBearing } from '../utils/mapUtils';
import { BsBusFront } from 'react-icons/bs';

interface MapLibreMapProps {
    buses: any[];
    focusedLocation?: { lat: number, lng: number } | null;
    stopMarkers?: { lat: number, lng: number, name: string, isCompleted?: boolean }[];
    followBus?: boolean;
    path?: [number, number][];
    selectedBusId?: string | null;
    routes?: any[];
    selectedRouteId?: string | null;
    onBusClick?: (busId: string) => void;
    showStopCircles?: boolean;
    routePreviewPath?: [number, number][]; // [lng, lat] pairs for the preview polyline
}

export const getBusLatLng = (bus: any): [number, number] | null => {
    if (!bus) return null;

    // Support location, currentLocation, current_location, or top-level lat/lng
    const src =
        bus.location ||
        bus.currentLocation ||
        bus.current_location ||
        bus;

    const lat =
        src?.latitude ??
        src?.lat ??
        bus.latitude ??
        bus.lat ??
        null;

    const lng =
        src?.longitude ??
        src?.lng ??
        bus.longitude ??
        bus.lng ??
        null;

    if (lat === null || lng === null || isNaN(Number(lat)) || isNaN(Number(lng))) return null;

    return [Number(lng), Number(lat)];
};

// Helper to create a circle polygon (100m radius — matches ARRIVED_RADIUS_M)
const createCirclePolygon = (center: [number, number], radiusInMeters: number = 100, points: number = 64) => {
    const coords = {
        latitude: center[1],
        longitude: center[0]
    };
    const ret = [];
    const distanceX = radiusInMeters / (111320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = radiusInMeters / 110540;

    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]); // close the loop

    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [ret]
        },
        properties: {}
    };
};

// Helper: get expected update interval from tracking mode
const getExpectedInterval = (bus: any): number => {
    const mode = bus.trackingMode || 'FAR';
    return mode === 'NEAR_STOP' ? 5000 : 20000; // ms
};

// Helper: get status color
const getStatusColor = (bus: any): string => {
    const status = bus.status;
    if (status === 'ARRIVED') return '#16a34a';    // green
    if (status === 'ARRIVING') return '#f59e0b';   // amber
    if (status === 'MAINTENANCE') return '#ea580c'; // orange
    if (status === 'ON_ROUTE' || status === 'ACTIVE') return '#3b82f6'; // blue
    return '#64748b'; // slate (IDLE/Offline)
};

// Helper: get status label
const getStatusLabel = (bus: any): string => {
    const s = bus.status;
    if (s === 'ARRIVED') return 'Arrived';
    if (s === 'ARRIVING') return 'Arriving';
    if (s === 'ON_ROUTE' || s === 'ACTIVE') return 'On Route';
    return s || 'Offline';
};

const MapLibreMap = ({ buses, focusedLocation, followBus: externalFollowBus, path, selectedBusId, routes, selectedRouteId, onBusClick, stopMarkers, showStopCircles, routePreviewPath }: MapLibreMapProps) => {
    const mapRef = useRef<MapRef | null>(null);

    // Type definition for DOM Marker State
    const markersRef = useRef<{ [key: string]: { marker: maplibregl.Marker, root: ReturnType<typeof createRoot> } }>({});

    // Time-based interpolation refs for smooth animation with 20s update gaps
    const anchorRef = useRef<{
        [key: string]: {
            prevPos: [number, number], prevTime: number, prevBearing: number,
            currPos: [number, number], currTime: number, currBearing: number,
            animPos: [number, number], animBearing: number
        }
    }>({});
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
        } else if (path && path.length > 0) {
            // Center on path midpoint for trip detail views
            center = [path[0][1], path[0][0]]; // [lng, lat]
            zoom = 14;
        } else if (stopMarkers && stopMarkers.length > 0) {
            center = [stopMarkers[0].lng, stopMarkers[0].lat];
            zoom = 15;
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

            const color = getStatusColor(bus);
            const statusLabel = getStatusLabel(bus);
            const isLive = ['ON_ROUTE', 'ACTIVE', 'ARRIVING', 'ARRIVED'].includes(bus.status);
            const modeLabel = bus.trackingMode === 'NEAR_STOP' ? 'Live (fast)' : 'Live (eco)';

            // React guarantees fast targeted updates to this specific DOM portal
            markerState.root.render(
                <div
                    className="relative flex items-center justify-center drop-shadow-md transition-transform hover:scale-110 group cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onBusClick) onBusClick(bus._id);
                    }}
                >
                    {selectedBusId === bus._id && (
                        <div className="absolute w-14 h-14 bg-dashboard-primary/20 rounded-full animate-pulse" />
                    )}
                    {bus.status === 'ARRIVED' && (
                        <div className="absolute w-12 h-12 bg-green-400/30 rounded-full animate-ping" />
                    )}
                    <BsBusFront
                        color={color}
                        size={32}
                        className="bus-icon-svg relative z-10 transition-transform duration-200"
                        style={{ transform: `rotate(${bus.location?.heading || 0}deg)` }}
                    />
                    {/* Tooltip */}
                    <div className={`absolute top-10 whitespace-nowrap bg-dashboard-surface text-dashboard-text border border-dashboard-border shadow-soft text-[11px] font-bold px-3 py-1.5 rounded-lg pointer-events-none transition-opacity z-50 flex flex-col gap-0.5 ${selectedBusId === bus._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className="flex items-center gap-2">
                            <span>Bus {bus.busNumber || 'Unknown'} • {bus.driverName || 'No Driver'}</span>
                            {isLive && (
                                <span className="text-dashboard-primary">
                                    {Math.round(bus.speed ?? bus.speedMph ?? bus.speedMPH ?? 0)} mph
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {bus.routeName && <span className="text-[10px] text-dashboard-muted font-medium">{bus.routeName}</span>}
                            {isLive && <span className="text-[9px] text-dashboard-muted/70">• {modeLabel}</span>}
                        </div>
                        {(bus.status === 'ARRIVING' || bus.status === 'ARRIVED') && (
                            <span className={`text-[10px] font-bold ${bus.status === 'ARRIVED' ? 'text-green-600' : 'text-amber-600'}`}>{statusLabel}</span>
                        )}
                    </div>
                </div>
            );

            // Sync stationary bus immediately
            const moving = ['ON_ROUTE', 'ACTIVE', 'ARRIVING', 'ARRIVED'].includes(bus.status);
            if (!moving) {
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

    // --- Time-Based Interpolation Engine ---
    // Update anchor points when Firestore data changes
    useEffect(() => {
        const now = Date.now();
        buses.forEach(bus => {
            const latLng = getBusLatLng(bus);
            if (!latLng) return;

            const existing = anchorRef.current[bus._id];
            const bearing = bus.location?.heading || bus.heading || 0;

            if (!existing) {
                // First time seeing this bus — initialize both anchors to current position
                anchorRef.current[bus._id] = {
                    prevPos: latLng, prevTime: now - 1000, prevBearing: bearing,
                    currPos: latLng, currTime: now, currBearing: bearing,
                    animPos: [...latLng] as [number, number], animBearing: bearing,
                };
            } else {
                // Check if position actually changed (new Firestore update arrived)
                const dx = latLng[0] - existing.currPos[0];
                const dy = latLng[1] - existing.currPos[1];
                if (Math.abs(dx) > 0.000001 || Math.abs(dy) > 0.000001) {
                    // Shift current → prev, set new current
                    existing.prevPos = [...existing.currPos] as [number, number];
                    existing.prevTime = existing.currTime;
                    existing.prevBearing = existing.currBearing;
                    existing.currPos = latLng;
                    existing.currTime = now;
                    existing.currBearing = bearing;
                }
            }
        });
    }, [buses]);

    // Animation loop: interpolate marker positions between anchor points
    useEffect(() => {
        const busesWithLoc = buses.filter(b => getBusLatLng(b));
        if (busesWithLoc.length === 0) return;

        const animate = () => {
            const now = Date.now();

            busesWithLoc.forEach(bus => {
                const anchor = anchorRef.current[bus._id];
                if (!anchor) return;

                const moving = ['ON_ROUTE', 'ACTIVE', 'ARRIVING', 'ARRIVED'].includes(bus.status);
                if (!moving) {
                    anchor.animPos = [...anchor.currPos] as [number, number];
                    anchor.animBearing = anchor.currBearing;
                } else {
                    // Time-based interpolation
                    const duration = Math.max(anchor.currTime - anchor.prevTime, 100);
                    const elapsed = now - anchor.currTime;
                    // Allow extrapolation up to 1.5x the expected interval for smooth coasting
                    const expectedInterval = getExpectedInterval(bus);
                    const maxProgress = 1 + (expectedInterval * 0.3 / duration);
                    const progress = Math.min(elapsed / duration + 1, maxProgress); // +1 because we start from prevTime
                    const t = Math.max(0, Math.min(progress, maxProgress));

                    // Lerp position: at t=1, we're at currPos. At t>1, we coast beyond.
                    const dx = anchor.currPos[0] - anchor.prevPos[0];
                    const dy = anchor.currPos[1] - anchor.prevPos[1];
                    anchor.animPos[0] = anchor.prevPos[0] + dx * t;
                    anchor.animPos[1] = anchor.prevPos[1] + dy * t;

                    // Bearing interpolation or calculation
                    if (anchor.currBearing) {
                        anchor.animBearing = anchor.currBearing;
                    } else if (Math.abs(dx) > 0.000001 || Math.abs(dy) > 0.000001) {
                        anchor.animBearing = calculateBearing(
                            { lat: anchor.prevPos[1], lng: anchor.prevPos[0] },
                            { lat: anchor.currPos[1], lng: anchor.currPos[0] }
                        );
                    }
                }

                // Update marker on map
                const markerData = markersRef.current[bus._id];
                if (markerData?.marker) {
                    markerData.marker.setLngLat(anchor.animPos);
                    const iconEl = markerData.marker.getElement().querySelector('.bus-icon-svg') as HTMLElement;
                    if (iconEl) iconEl.style.transform = `rotate(${anchor.animBearing}deg)`;
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
            // Use animated position if available
            const animated = anchorRef.current[activeBusWithLocation._id];
            const center = animated ? animated.animPos : getBusLatLng(activeBusWithLocation);
            if (center) mapRef.current.panTo(center, { duration: 800 });
        }
    }, [followBusEnabled, activeBusWithLocation]);

    // Fit map to trip path bounds when path data is available
    useEffect(() => {
        if (path && path.length > 1 && mapRef.current) {
            const map = mapRef.current;
            const bounds = new maplibregl.LngLatBounds();
            path.forEach(p => bounds.extend([p[1], p[0]])); // [lng, lat]
            map.fitBounds(bounds, { padding: 60, duration: 800 });
        }
    }, [path]);

    // Note: Selection camera logic moved to dynamic centering effect below
    useEffect(() => {
        if (selectedBusId && mapRef.current) {
            const bus = buses.find(b => b._id === selectedBusId);
            const latLng = getBusLatLng(bus);
            if (latLng) mapRef.current.flyTo({ center: latLng, zoom: 17, duration: 1000 });
        }
    }, [selectedBusId, buses]);

    // --- Dynamic Centering & Fit Bounds ---
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        if (focusedLocation) {
            map.flyTo({
                center: [focusedLocation.lng, focusedLocation.lat],
                zoom: 17,
                essential: true
            });
        } else if (stopMarkers && stopMarkers.length > 0) {
            // If only one marker, fly to it; if multiple, fit bounds
            if (stopMarkers.length === 1) {
                map.flyTo({
                    center: [stopMarkers[0].lng, stopMarkers[0].lat],
                    zoom: 15,
                    essential: true
                });
            } else {
                const bounds = new maplibregl.LngLatBounds();
                stopMarkers.forEach(m => {
                    if (m.lng && m.lat) bounds.extend([m.lng, m.lat]);
                });
                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 80, duration: 1000 });
                }
            }
        }
    }, [focusedLocation, stopMarkers]);

    return (
        <div className="h-full w-full relative z-0 bg-slate-50 overflow-hidden rounded-2xl border border-slate-200">
            {/* Fleet Monitor idle overlay removed for clean UX during route editing */}

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

                {/* 50m Stop Circles (Geofence Preview - Exact Polygons) */}
                {showStopCircles && stopMarkers && stopMarkers.length > 0 && (
                    <Source
                        id="stop-circles-source"
                        type="geojson"
                        data={{
                            type: 'FeatureCollection',
                            features: stopMarkers
                                .filter(m => m.lat && m.lng)
                                .map(m => createCirclePolygon([m.lng, m.lat], 100))
                        }}
                    >
                        <Layer
                            id="stop-circles-fill"
                            type="fill"
                            paint={{
                                'fill-color': '#f97316',
                                'fill-opacity': 0.15,
                                'fill-outline-color': '#f97316'
                            }}
                        />
                    </Source>
                )}

                {/* Route Preview Path Polyline */}
                {routePreviewPath && routePreviewPath.length > 1 && (
                    <>
                        <Source id="route-preview-path" type="geojson" data={{
                            type: "Feature",
                            geometry: { type: "LineString", coordinates: routePreviewPath },
                            properties: {}
                        }}>
                            <Layer
                                id="route-preview-line"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{ 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.6 }}
                            />
                        </Source>

                        {/* Start Marker (Green) */}
                        <Marker longitude={routePreviewPath[0][0]} latitude={routePreviewPath[0][1]} anchor="center">
                            <div className="bg-emerald-500 border-2 border-white w-4 h-4 rounded-full shadow-lg z-20" title="Start Point" />
                        </Marker>

                        {/* End Marker (Red) */}
                        <Marker longitude={routePreviewPath[routePreviewPath.length - 1][0]} latitude={routePreviewPath[routePreviewPath.length - 1][1]} anchor="center">
                            <div className="bg-rose-500 border-2 border-white w-4 h-4 rounded-full shadow-lg z-20" title="End Point" />
                        </Marker>
                    </>
                )}
            </Map>
        </div>
    );
};

export default MapLibreMap;
