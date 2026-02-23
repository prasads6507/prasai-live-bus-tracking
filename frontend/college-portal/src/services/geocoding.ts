// Shared reverse geocoding service
// Routes through the local backend proxy to avoid browser CORS issues with Nominatim
// Caches results by rounded coordinates (4 decimals) to reduce API calls

import { api } from './api';

const locationCache: { [key: string]: string } = {};

export const getStreetName = async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (locationCache[cacheKey]) return locationCache[cacheKey];

    try {
        // Request proxy through the backend server
        const response = await api.get(`/geocode?lat=${lat}&lon=${lon}`);
        const address = response.data.address || {};

        const parts = [
            address.road || address.neighbourhood || address.suburb,
            address.city || address.town || address.village || address.county
        ].filter(Boolean);

        const result = parts.join(', ') || 'Unknown Location';
        locationCache[cacheKey] = result;
        return result;
    } catch (err) {
        return 'Location unavailable';
    }
};

export default getStreetName;
