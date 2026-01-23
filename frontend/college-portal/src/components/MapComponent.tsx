import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { Bus, Navigation } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

interface MapComponentProps {
    buses: any[];
}

const MapComponent = ({ buses }: MapComponentProps) => {
    // Default center (can be updated to be dynamic based on first bus or college location)
    const defaultCenter: [number, number] = [17.3850, 78.4867]; // Hyderabad coords as default fallback

    // Custom Bus Icon
    const createBusIcon = (status: string) => {
        const color = status === 'ACTIVE' ? '#16a34a' : (status === 'MAINTENANCE' ? '#ea580c' : '#dc2626');

        const iconMarkup = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <div className="absolute -inset-1 rounded-full opacity-50 animate-pulse" style={{ backgroundColor: color }}></div>
                <div className="relative z-10 p-1.5 rounded-full shadow-lg border-2 border-white text-white" style={{ backgroundColor: color }}>
                    <Bus size={20} />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style={{ borderTopColor: color }}></div>
            </div>
        );

        return divIcon({
            html: iconMarkup,
            className: 'custom-bus-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 40], // Point at bottom center
            popupAnchor: [0, -40]
        });
    };

    return (
        <div className="h-[500px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative z-0">
            <MapContainer
                center={defaultCenter}
                zoom={12}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {buses.map((bus) => {
                    // Ensure bus has valid coordinates
                    if (!bus.location || !bus.location.latitude || !bus.location.longitude) return null;

                    return (
                        <Marker
                            key={bus._id}
                            position={[bus.location.latitude, bus.location.longitude]}
                            icon={createBusIcon(bus.status)}
                        >
                            <Popup>
                                <div className="p-1">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Bus size={16} className="text-blue-600" />
                                        {bus.busNumber}
                                    </h3>
                                    <div className="text-xs text-slate-500 mt-1">
                                        <p>Route: {bus.routeName || 'Unassigned'}</p>
                                        <p>Speed: {bus.speed ? `${bus.speed} km/h` : '0 km/h'}</p>
                                        <p className="mt-1 font-semibold" style={{
                                            color: bus.status === 'ACTIVE' ? '#16a34a' : '#ea580c'
                                        }}>
                                            {bus.status || 'OFFLINE'}
                                        </p>
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
