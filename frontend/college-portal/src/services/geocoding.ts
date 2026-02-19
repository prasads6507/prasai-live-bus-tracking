// Shared reverse geocoding service using OpenStreetMap Nominatim
// Caches results by rounded coordinates (4 decimals) to reduce API calls

const locationCache: { [key: string]: string } = {};

export const getStreetName = async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (locationCache[cacheKey]) return locationCache[cacheKey];

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`
        );
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
