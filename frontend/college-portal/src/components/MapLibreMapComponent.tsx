import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapLibreMapComponentProps {
    path?: [number, number][]; // Array of [lat, lng]
    buses?: any[]; // optional live bus markers
    stops?: any[]; // optional stop markers
    followBus?: boolean;
    focusedLocation?: { lat: number, lng: number } | null;
}

export const getBusLatLng = (bus: any): [number, number] | null => {
    if (!bus) return null;

    // Check all possible field structures
    const lat = bus.location?.latitude ?? bus.location?.lat ??
        bus.currentLocation?.latitude ?? bus.currentLocation?.lat ??
        bus.current_location?.lat ?? bus.latitude;

    const lng = bus.location?.longitude ?? bus.location?.lng ??
        bus.currentLocation?.longitude ?? bus.currentLocation?.lng ??
        bus.current_location?.lng ?? bus.longitude;

    if (lat === undefined || lng === undefined) return null;

    // Always return MapLibre standard [lng, lat]
    return [lng, lat]; // Lng, Lat for MapLibre
};

const MapLibreMapComponent = ({ path, buses, followBus, focusedLocation, stops }: MapLibreMapComponentProps) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

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
                            'ON_ROUTE', '#16a34a',
                            'MAINTENANCE', '#ea580c',
                            /* default */ '#64748b'
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });

                // Optional label layer
                if (!map.getLayer('buses-label')) {
                    map.addLayer({
                        id: 'buses-label',
                        type: 'symbol',
                        source: 'buses-source',
                        layout: {
                            'text-field': ['get', 'busNumber'],
                            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            'text-size': 11,
                            'text-offset': [0, 1.5],
                            'text-anchor': 'top'
                        },
                        paint: {
                            'text-color': '#1e293b',
                            'text-halo-color': '#ffffff',
                            'text-halo-width': 2
                        }
                    });
                }
            }
        };

        // Critical Agent Rule: MapLibre realtime pipeline reliability
        map.on('style.load', () => {
            setupLayers();
            updateDataRef.current(); // Re-apply data immediately
        });

        // Run setup immediately if map loaded fast
        if (map.loaded()) {
            setupLayers();
        } else {
            map.on('load', setupLayers);
        }

        return () => {
            map.remove();
        };
    }, []);

    // Sync Data logic wrapped in ref to prevent stale closures inside map styles
    const updateDataRef = useRef(() => { });

    updateDataRef.current = () => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        const pathSource = map.getSource('trip-path') as maplibregl.GeoJSONSource;
        if (pathSource && path) {
            pathSource.setData({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: path.map(p => [p[1], p[0]])
                }
            });

            if (path.length > 1 && !followBus) {
                const bounds = new maplibregl.LngLatBounds();
                path.forEach(p => bounds.extend([p[1], p[0]]));
                map.fitBounds(bounds, { padding: 50, duration: 1000 });
            }
        }

        const busSource = map.getSource('buses-source') as maplibregl.GeoJSONSource;
        if (busSource && buses) {
            const features = buses
                .filter(b => getBusLatLng(b))
                .map(bus => ({
                    type: 'Feature' as const,
                    properties: {
                        busId: bus._id,
                        busNumber: bus.busNumber || 'Unknown',
                        status: bus.status
                    },
                    geometry: {
                        type: 'Point' as const,
                        coordinates: getBusLatLng(bus)!
                    }
                }));

            busSource.setData({
                type: 'FeatureCollection',
                features: features
            });
        }
    };

    useEffect(() => {
        updateDataRef.current();
    }, [path, buses, followBus, focusedLocation, stops]);

    // Fast camera focus
    useEffect(() => {
        if (focusedLocation && mapRef.current) {
            mapRef.current.flyTo({
                center: [focusedLocation.lng, focusedLocation.lat],
                zoom: 16,
                duration: 1000
            });
        }
    }, [focusedLocation]);

    return (
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} className="rounded-xl overflow-hidden shadow-sm flex-1 absolute inset-0" />
    );
};

export default MapLibreMapComponent;
