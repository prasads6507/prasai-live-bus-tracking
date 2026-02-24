import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineString, point } from '@turf/helpers';

interface MapLibreMapComponentProps {
    path?: [number, number][]; // Array of [lat, lng]
    buses?: any[]; // optional live bus markers
    stops?: any[]; // optional stop markers
    nextStopId?: string | null;
    arrivedStopIds?: string[];
    followBus?: boolean;
    focusedLocation?: { lat: number, lng: number } | null;
}

// Helper to create a GeoJSON polygon representing a circle with a radius in meters
const createCirclePolygon = (center: [number, number], radiusInMeters: number, points: number = 64) => {
    const coords = {
        latitude: center[1],
        longitude: center[0]
    };
    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]); // close the polygon

    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [ret]
        },
        properties: {}
    };
};

export const getBusLatLng = (bus: any): [number, number] | null => {
    if (!bus) return null;

    const src =
        bus.location ||
        bus.currentLocation ||
        bus.current_location ||
        null;

    const lat =
        src?.latitude ??
        src?.lat ??
        bus.latitude ??
        null;

    const lng =
        src?.longitude ??
        src?.lng ??
        bus.longitude ??
        null;

    if (lat === null || lng === null) return null;

    return [Number(lng), Number(lat)];
};

const MapLibreMapComponent = ({ path, buses, followBus: _followBus, focusedLocation, stops, nextStopId, arrivedStopIds: arrivesStopIds }: MapLibreMapComponentProps) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const animationRef = useRef<{
        [busId: string]: {
            prev: [number, number];   // [lng, lat]
            next: [number, number];   // [lng, lat]
            startTime: number;
            duration: number;
            heading: number;
            status: string;
            busNumber: string;
            lastFirestoreUpdate: number;
        }
    }>({});
    const requestRef = useRef<number | null>(null);
    const updateDataRef = useRef<() => void>(() => { });

    // Memoize the turf path for snapping
    const routeLine = useMemo(() => {
        if (!path || path.length < 2) return null;
        try {
            return lineString(path.map(p => [p[1], p[0]]));
        } catch (e) {
            console.warn("Invalid path for routeLine", e);
            return null;
        }
    }, [path]);

    // Initial load
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const defaultCenter: [number, number] = [78.4867, 17.3850];
        let initialCenter = defaultCenter;

        if (path && path.length > 0) {
            initialCenter = [path[0][1], path[0][0]]; // lng, lat
        } else if (buses && buses.length > 0 && getBusLatLng(buses[0])) {
            initialCenter = getBusLatLng(buses[0])!;
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: import.meta.env.VITE_MAP_STYLE_URL || 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: initialCenter,
            zoom: 13,
            pitch: 0,
            bearing: 0,
            dragRotate: false,
            pitchWithRotate: false
        });

        // Add controls
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');

        mapRef.current = map;

        const setupLayers = () => {
            if (!map.isStyleLoaded()) return;

            // 1. Re-add Images
            // To ensure reliability we draw a geometric bus pin if external image fails, 
            // but we can also load an external image if available. For now, we use a simple circle for the bus 
            // natively or add a built-in GeoJSON icon. MapLibre supports custom shapes.

            // 2. Add Sources
            if (!map.getSource('trip-path')) {
                map.addSource('trip-path', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: [] }
                    }
                });
            }

            if (!map.getSource('buses-source')) {
                map.addSource('buses-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            if (!map.getSource('stop-circles-source')) {
                map.addSource('stop-circles-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            if (!map.getSource('stop-markers-source')) {
                map.addSource('stop-markers-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            // 3. Add Layers
            if (!map.getLayer('trip-path-line')) {
                map.addLayer({
                    id: 'trip-path-line',
                    type: 'line',
                    source: 'trip-path',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': 5,
                        'line-opacity': 0.8
                    }
                });
            }

            if (!map.getLayer('buses-layer')) {
                map.addLayer({
                    id: 'buses-layer',
                    type: 'circle',
                    source: 'buses-source',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': [
                            'match',
                            ['get', 'status'],
                            'match', ['get', 'status'],
                            'ON_ROUTE', '#16a34a',
                            'MAINTENANCE', '#ea580c',
                            'OFFLINE', '#64748b',
                            '#64748b'
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                        'circle-opacity': ['get', 'opacity']
                    }
                });
            }

            if (!map.getSource('stop-circles-source')) {
                map.addSource('stop-circles-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'stop-circles-layer',
                    type: 'fill',
                    source: 'stop-circles-source',
                    paint: {
                        'fill-color': ['match', ['get', 'status'], 'NEXT', '#3b82f6', 'ARRIVED', '#10b981', '#f97316'],
                        'fill-opacity': 0.15
                    }
                });
            }

            if (!map.getSource('stop-markers-source')) {
                map.addSource('stop-markers-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'stop-markers-layer',
                    type: 'circle',
                    source: 'stop-markers-source',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': ['match', ['get', 'status'], 'NEXT', '#3b82f6', 'ARRIVED', '#10b981', '#f97316'],
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#fff'
                    }
                });
            }
        };

        map.on('load', setupLayers);
        return () => map.remove();
    }, []); // Only once

    // Data synchronization
    updateDataRef.current = () => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        // Path update
        const pathSource = map.getSource('trip-path') as maplibregl.GeoJSONSource;
        if (pathSource && path) {
            pathSource.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path.map(p => [p[1], p[0]]) } });
        }

        // Animation internal state update
        if (buses) {
            const now = Date.now();
            buses.forEach(bus => {
                const pos = getBusLatLng(bus);
                if (!pos) return;
                const existing = animationRef.current[bus._id];
                const lastUpdate = bus.lastLocationUpdate?.seconds ? bus.lastLocationUpdate.seconds * 1000 : now;

                if (!existing) {
                    animationRef.current[bus._id] = { prev: pos, next: pos, startTime: now, duration: 100, heading: bus.heading ?? 0, status: bus.status, busNumber: bus.busNumber || '?', lastFirestoreUpdate: lastUpdate };
                } else if (existing.lastFirestoreUpdate !== lastUpdate) {
                    existing.prev = existing.next;
                    existing.next = pos;
                    existing.startTime = now;
                    existing.duration = bus.trackingMode === 'NEAR_STOP' ? 5000 : 20000;
                    existing.lastFirestoreUpdate = lastUpdate;
                }
            });
        }

        // Stops update
        const stopCircleSource = map.getSource('stop-circles-source') as maplibregl.GeoJSONSource;
        const stopMarkerSource = map.getSource('stop-markers-source') as maplibregl.GeoJSONSource;
        if (stopCircleSource && stopMarkerSource && stops) {
            const circleFeatures = stops.map(stop => {
                const lat = stop.lat ?? stop.latitude;
                const lng = stop.lng ?? stop.longitude;
                const status = arrivesStopIds?.includes(stop.id || stop._id) ? 'ARRIVED' : (nextStopId === (stop.id || stop._id) ? 'NEXT' : 'UPCOMING');
                const circle = createCirclePolygon([lng, lat], stop.radiusM || 100);
                (circle as any).properties = { status };
                return circle;
            });
            const markerFeatures = stops.map(stop => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [stop.lng ?? stop.longitude, stop.lat ?? stop.latitude] },
                properties: { status: arrivesStopIds?.includes(stop.id || stop._id) ? 'ARRIVED' : (nextStopId === (stop.id || stop._id) ? 'NEXT' : 'UPCOMING') }
            }));
            stopCircleSource.setData({ type: 'FeatureCollection', features: circleFeatures as any });
            stopMarkerSource.setData({ type: 'FeatureCollection', features: markerFeatures as any });
        }
    };

    useEffect(() => { updateDataRef.current(); }, [path, buses, stops, nextStopId, arrivesStopIds]);

    // Animation Loop
    useEffect(() => {
        const animate = () => {
            const map = mapRef.current;
            if (map?.isStyleLoaded()) {
                const busSource = map.getSource('buses-source') as maplibregl.GeoJSONSource;
                if (busSource) {
                    const now = Date.now();
                    const features = Object.keys(animationRef.current).map(id => {
                        const anim = animationRef.current[id];
                        const t = Math.min(1, (now - anim.startTime) / anim.duration);
                        const isStale = (now - anim.lastFirestoreUpdate) > 120000;
                        let lng = anim.prev[0] + (anim.next[0] - anim.prev[0]) * (isStale ? 1 : t);
                        let lat = anim.prev[1] + (anim.next[1] - anim.prev[1]) * (isStale ? 1 : t);

                        if (routeLine && !isStale) {
                            try {
                                const snapped = nearestPointOnLine(routeLine, point([lng, lat]));
                                if ((snapped.properties.dist ?? 0) < 0.2) {
                                    [lng, lat] = snapped.geometry.coordinates;
                                }
                            } catch (e) { }
                        }

                        return {
                            type: 'Feature',
                            properties: { busId: id, busNumber: anim.busNumber, status: isStale ? 'OFFLINE' : anim.status, opacity: isStale ? 0.5 : 1.0 },
                            geometry: { type: 'Point', coordinates: [lng, lat] }
                        };
                    });
                    busSource.setData({ type: 'FeatureCollection', features: features as any });
                }
            }
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [routeLine]);

    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-100">
            <div ref={mapContainerRef} className="w-full h-full" />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]"></span><span className="text-[10px] font-bold text-slate-600 uppercase">Live</span></div>
                <div className="h-4 w-[1px] bg-slate-200"></div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#64748b]"></span><span className="text-[10px] font-bold text-slate-600 uppercase">Offline</span></div>
            </div>
            {focusedLocation && (
                <button
                    onClick={() => mapRef.current?.flyTo({ center: [focusedLocation.lng, focusedLocation.lat], zoom: 16 })}
                    className="absolute bottom-4 right-14 bg-blue-600 text-white p-2 rounded-full shadow-lg"
                > Focus </button>
            )}
        </div>
    );
};

export default MapLibreMapComponent;
