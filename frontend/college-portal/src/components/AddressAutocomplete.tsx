import { useState, useEffect, useRef } from 'react';
import { Search, MapPin } from 'lucide-react';

interface AddressAutocompleteProps {
    initialAddress?: string;
    onSelect: (data: { address: string; lat: number; lng: number }) => void;
    placeholder?: string;
    className?: string;
    biasLat?: number;
    biasLon?: number;
}

export default function AddressAutocomplete({
    initialAddress = '',
    onSelect,
    placeholder = 'Search full address (incl. building no.)...',
    className = '',
    biasLat,
    biasLon
}: AddressAutocompleteProps) {
    const [query, setQuery] = useState(initialAddress);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(initialAddress);
    }, [initialAddress]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query || query.length < 3 || query === initialAddress) {
            setSuggestions([]);
            return;
        }

        const fetchSuggestions = async () => {
            setLoading(true);
            try {
                // Nominatim for full-address precision (includes house/building numbers)
                let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`;
                if (biasLat !== undefined && biasLon !== undefined) {
                    // Use viewbox bias: 0.5 degree (~55km) around the reference point
                    const delta = 0.5;
                    url += `&viewbox=${biasLon - delta},${biasLat - delta},${biasLon + delta},${biasLat + delta}&bounded=0`;
                }

                const res = await fetch(url, {
                    headers: { 'Accept-Language': 'en' }
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    setSuggestions(data);
                    setIsOpen(true);
                }
            } catch (err) {
                console.error("Nominatim Search Error:", err);
            }
            setLoading(false);
        };

        const timeoutId = setTimeout(fetchSuggestions, 400); // Debounce
        return () => clearTimeout(timeoutId);
    }, [query, initialAddress, biasLat, biasLon]);

    const handleSelect = async (result: any) => {
        setIsOpen(false);
        const displayAddress = result.display_name || '';
        setQuery(displayAddress);

        let lat = parseFloat(result.lat);
        let lng = parseFloat(result.lon);

        try {
            // OSRM Nearest API to snap building coordinate to the nearest road network
            // (Crucial for bus stop accuracy on the map)
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

    // Build a concise label from Nominatim address components
    const buildShortLabel = (result: any): string => {
        const addr = result.address || {};
        return [
            addr.house_number,
            addr.road || addr.street,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village || addr.county,
            addr.state,
            addr.country
        ].filter(Boolean).join(', ');
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
                <div className="absolute z-[200] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {suggestions.map((result, i) => {
                        const shortLabel = buildShortLabel(result);
                        const fullLabel = result.display_name;
                        return (
                            <div
                                key={i}
                                onClick={() => handleSelect(result)}
                                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-start gap-2 border-b border-slate-50 last:border-0"
                            >
                                <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-xs font-semibold text-slate-800">{shortLabel || fullLabel}</div>
                                    {shortLabel && (
                                        <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{fullLabel}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Reverse Geocoding Utility using Nominatim (Free & High Precision OSM)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data.display_name) {
            return data.display_name;
        }
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
        console.error("Reverse Geocoding Error:", err);
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}
