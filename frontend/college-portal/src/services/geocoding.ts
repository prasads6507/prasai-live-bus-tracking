// Shared reverse geocoding service
// Uses the backend API proxy to avoid CORS issues (Nominatim blocks browser requests)
// Caches results by rounded coordinates (4 decimals) to reduce API calls

const locationCache: { [key: string]: string } = {};

// Relay/worker base URL for geocoding proxy
const getGeoProxyUrl = (): string => {
    // Prefer env variable if set (e.g., VITE_RELAY_URL=https://prasai-live-bus-tracking.xxx.workers.dev)
    const relayUrl = (import.meta as any).env?.VITE_RELAY_URL;
    if (relayUrl) return relayUrl;

    // Fallback: use the Nominatim directly (will work server-side or if CORS is not enforced)
    return 'https://nominatim.openstreetmap.org';
};

export const getStreetName = async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (locationCache[cacheKey]) return locationCache[cacheKey];

    try {
        const baseUrl = getGeoProxyUrl();
        const isProxy = !baseUrl.includes('nominatim');

        // If using proxy worker, use /geo/reverse; otherwise fall back to Nominatim format
        const url = isProxy
            ? `${baseUrl}/geo/reverse?lat=${lat}&lon=${lon}`
            : `${baseUrl}/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`;

        const response = await fetch(url);
        const data = await response.json();
        const address = data.address || {};
        const parts = [
            address.road || address.neighbourhood || address.suburb,
            address.city || address.town || address.village || address.county
        ].filter(Boolean);
        const result = parts.join(', ') || 'Unknown Location';
        locationCache[cacheKey] = result;
        return result;
    } catch {
        return 'Location unavailable';
    }
};

export default getStreetName;
