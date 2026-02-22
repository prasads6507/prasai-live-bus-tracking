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
                // ArcGIS World Geocoding Service (high precision, Google-like)
                let url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?text=${encodeURIComponent(query)}&f=json&maxSuggestions=8`;
                if (biasLat !== undefined && biasLon !== undefined) {
                    url += `&location=${biasLon},${biasLat}&distance=50000`; // 50km bias
                }

                const res = await fetch(url);
                const data = await res.json();
                if (data.suggestions) {
                    setSuggestions(data.suggestions);
                    setIsOpen(true);
                }
            } catch (err) {
                console.error("ArcGIS Search Error:", err);
            }
            setLoading(false);
        };

        const timeoutId = setTimeout(fetchSuggestions, 400); // Debounce
        return () => clearTimeout(timeoutId);
    }, [query, initialAddress, biasLat, biasLon]);

    const handleSelect = async (suggestion: any) => {
        setIsOpen(false);
        const displayAddress = suggestion.text || '';
        setQuery(displayAddress);

        try {
            // Get coordinates for the selected suggestion using its magicKey
            let candidatesUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(displayAddress)}&magicKey=${suggestion.magicKey}&f=json&maxLocations=1`;
            const geoRes = await fetch(candidatesUrl);
            const geoData = await geoRes.json();

            if (geoData.candidates && geoData.candidates.length > 0) {
                let lat = geoData.candidates[0].location.y;
                let lng = geoData.candidates[0].location.x;

                // OSRM Nearest API to snap building coordinate to the nearest road network
                try {
                    const osrmRes = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`);
                    const osrmData = await osrmRes.json();
                    if (osrmData.code === 'Ok' && osrmData.waypoints && osrmData.waypoints.length > 0) {
                        lat = osrmData.waypoints[0].location[1];
                        lng = osrmData.waypoints[0].location[0];
                    }
                } catch (err) {
                    console.error("OSRM Snapping Error:", err);
                }

                onSelect({ address: displayAddress, lat, lng });
            }
        } catch (err) {
            console.error("ArcGIS Location Error:", err);
        }
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
                    className={`pl-8 pr-3 py-1.5 w-full focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none ${className}`}
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
                        return (
                            <div
                                key={i}
                                onClick={() => handleSelect(result)}
                                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-start gap-2 border-b border-slate-50 last:border-0"
                            >
                                <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-xs font-semibold text-slate-800 line-clamp-2">
                                        {result.text}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Reverse Geocoding Utility using ArcGIS (Free & High Precision)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json`);
        const data = await res.json();
        if (data.address && data.address.LongLabel) {
            return data.address.LongLabel;
        } else if (data.address && data.address.Match_addr) {
            return data.address.Match_addr;
        }
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
        console.error("Reverse Geocoding Error:", err);
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}
