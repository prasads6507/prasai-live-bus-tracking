import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { Bus, MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

interface MapComponentProps {
    buses: any[];
}

// Component to handle map re-centering
const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        if (center[0] !== 0 && center[1] !== 0) {
            map.setView(center);
        }
    }, [center, map]);
    return null;
};

const MapComponent = ({ buses }: MapComponentProps) => {
    // Default center (Hyderabad)
    const defaultCenter: [number, number] = [17.3850, 78.4867];

    // Log bus data for debugging
    console.log('MapComponent received buses:', buses.length, buses.map(b => ({
        id: b._id,
        status: b.status,
        location: b.location,
        lastUpdated: b.lastUpdated
    })));

    // Find first active bus with location or first bus with location
    const activeBusWithLocation = buses.find(b => b.status === 'ON_ROUTE' && b.location?.latitude && b.location?.longitude);
    const anyBusWithLocation = buses.find(b => b.location?.latitude && b.location?.longitude);

    const mapCenter: [number, number] = activeBusWithLocation
        ? [activeBusWithLocation.location.latitude, activeBusWithLocation.location.longitude]
        : anyBusWithLocation
            ? [anyBusWithLocation.location.latitude, anyBusWithLocation.location.longitude]
            : defaultCenter;

    // Custom Bus Icon
    const createBusIcon = (status: string) => {
        const color = status === 'ON_ROUTE' ? '#16a34a' : (status === 'MAINTENANCE' ? '#ea580c' : '#3b82f6');

        const iconMarkup = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <div className={`absolute -inset-1 rounded-full opacity-50 ${status === 'ON_ROUTE' ? 'animate-pulse' : ''}`} style={{ backgroundColor: color }}></div>
                <div className="relative z-10 p-1.5 rounded-full shadow-lg border-2 border-white text-white" style={{ backgroundColor: color }}>
                    <Bus size={18} />
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
    };

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

            <MapContainer
                center={mapCenter}
                zoom={13}
                scrollWheelZoom={true}
                className="h-full w-full"
            >
                <ChangeView center={mapCenter} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {buses.map((bus) => {
                    if (!bus.location?.latitude || !bus.location?.longitude) return null;

                    return (
                        <Marker
                            key={bus._id}
                            position={[bus.location.latitude, bus.location.longitude]}
                            icon={createBusIcon(bus.status)}
                        >
                            <Popup>
                                <div className="p-1 min-w-[120px]">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-1 mb-1">
                                        <Bus size={14} className="text-blue-600" />
                                        {bus.busNumber}
                                    </h3>
                                    <div className="text-[10px] space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Status:</span>
                                            <span className="font-bold uppercase" style={{ color: bus.status === 'ON_ROUTE' ? '#16a34a' : '#3b82f6' }}>
                                                {bus.status === 'ON_ROUTE' ? 'Moving' : 'Idle'}
                                            </span>
                                        </div>
                                        {bus.speed > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Speed:</span>
                                                <span className="font-bold text-slate-700">{bus.speed} km/h</span>
                                            </div>
                                        )}
                                        <div className="pt-1 text-[9px] text-slate-400 italic">
                                            Last Updated: {new Date(bus.lastUpdated).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default MapComponent;
