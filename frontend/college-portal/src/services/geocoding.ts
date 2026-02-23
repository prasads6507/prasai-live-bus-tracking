// Shared reverse geocoding service
// Routes through Cloudflare Worker proxy to avoid browser CORS issues with Nominatim
// Auto-discovers the Worker URL from the relay token API response
// Caches results by rounded coordinates (4 decimals) to reduce API calls

import { getRelayToken } from './api';

const locationCache: { [key: string]: string } = {};

// Cached relay worker base URL (e.g., "https://prasai-live-bus-tracking.xxx.workers.dev")
let cachedWorkerBaseUrl: string | null = null;
let workerUrlDiscoveryPromise: Promise<string | null> | null = null;

/**
 * Auto-discover the Cloudflare Worker base URL by calling getRelayToken
 * and extracting the hostname from the returned wsUrl.
 *
 * wsUrl looks like: "wss://prasai-live-bus-tracking.xxx.workers.dev/ws/bus/BUSID?token=..."
 * We extract:       "https://prasai-live-bus-tracking.xxx.workers.dev"
 */
async function discoverWorkerUrl(): Promise<string | null> {
    // Check env variable first
    const envUrl = (import.meta as any).env?.VITE_RELAY_URL;
    if (envUrl) return envUrl;

    // Already discovered
    if (cachedWorkerBaseUrl) return cachedWorkerBaseUrl;

    // Avoid duplicate discovery calls
    if (workerUrlDiscoveryPromise) return workerUrlDiscoveryPromise;

    workerUrlDiscoveryPromise = (async () => {
        try {
            // Use a dummy busId — we only need the URL structure, not a valid token
            const resp = await getRelayToken('_discovery_', 'admin');
            const wsUrl: string = resp.wsUrl || '';
            if (wsUrl) {
                // Convert wss://host/path → https://host
                const url = new URL(wsUrl);
                cachedWorkerBaseUrl = `https://${url.host}`;
                console.log('[Geocoding] Discovered worker URL:', cachedWorkerBaseUrl);
                return cachedWorkerBaseUrl;
            }
        } catch (err) {
            console.warn('[Geocoding] Failed to discover worker URL:', err);
        }
        return null;
    })();

    const result = await workerUrlDiscoveryPromise;
    workerUrlDiscoveryPromise = null;
    return result;
}

export const getStreetName = async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (locationCache[cacheKey]) return locationCache[cacheKey];

    try {
        // Try to use the Worker proxy (CORS-safe)
        const workerUrl = await discoverWorkerUrl();

        let response: Response;
        if (workerUrl) {
            // Proxy through Cloudflare Worker — no CORS issues
            response = await fetch(`${workerUrl}/geo/reverse?lat=${lat}&lon=${lon}`);
        } else {
            // Last resort fallback — will fail in browsers with CORS, but works server-side
            response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`
            );
        }

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
