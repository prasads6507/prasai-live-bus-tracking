import { useState, useEffect, useRef } from 'react';
import { Search, MapPin } from 'lucide-react';

interface AddressAutocompleteProps {
    initialAddress?: string;
    onSelect: (data: { address: string; lat: number; lng: number }) => void;
    placeholder?: string;
    className?: string;
}

export default function AddressAutocomplete({ initialAddress = '', onSelect, placeholder = 'Search address...', className = '' }: AddressAutocompleteProps) {
    const [query, setQuery] = useState(initialAddress);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(initialAddress);
    }, [initialAddress]);

    useEffect(() => {
        // Handle outside click
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query || query === initialAddress) {
            setSuggestions([]);
            return;
        }

        const fetchSuggestions = async () => {
            setLoading(true);
            try {
                // Photon API for OSM Geocoding
                const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
                const data = await res.json();
                if (data.features) {
                    setSuggestions(data.features);
                    setIsOpen(true);
                }
            } catch (err) {
                console.error("Photon Search Error:", err);
            }
            setLoading(false);
        };

        const timeoutId = setTimeout(fetchSuggestions, 350); // Debounce
        return () => clearTimeout(timeoutId);
    }, [query, initialAddress]);

    const handleSelect = async (feature: any) => {
        setIsOpen(false);
        const name = feature.properties.name || feature.properties.street || '';
        const city = feature.properties.city || feature.properties.town || '';
        const displayAddress = [name, city].filter(Boolean).join(', ');

        setQuery(displayAddress);

        let lat = feature.geometry.coordinates[1];
        let lng = feature.geometry.coordinates[0];

        try {
            // OSRM Nearest API to snap to road network
            const osrmRes = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`);
            const osrmData = await osrmRes.json();
            if (osrmData.code === 'Ok' && osrmData.waypoints && osrmData.waypoints.length > 0) {
                const snappedLng = osrmData.waypoints[0].location[0];
                const snappedLat = osrmData.waypoints[0].location[1];
                lat = snappedLat;
                lng = snappedLng;
            }
        } catch (err) {
            console.error("OSRM Snapping Error:", err);
        }

        onSelect({ address: displayAddress, lat, lng });
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
                    placeholder={placeholder}
                    className={`pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none ${className}`}
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-3 w-3 border-2 border-slate-300 border-t-blue-600 rounded-full" />
                    </div>
                )}
            </div>

            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((feature, i) => {
                        const props = feature.properties;
                        const label = [props.name, props.street, props.city, props.state].filter(Boolean).join(', ');
                        return (
                            <div
                                key={i}
                                onClick={() => handleSelect(feature)}
                                className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-start gap-2 border-b border-slate-50 last:border-0"
                            >
                                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                <div className="text-xs text-slate-700">{label}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
