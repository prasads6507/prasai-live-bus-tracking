/**
 * Interpolates between two geographic coordinates
 * @param start - Starting {lat, lng}
 * @param end - Ending {lat, lng}
 * @param fraction - Fraction of distance (0.0 to 1.0)
 * @returns Interpolated {lat, lng}
 */
export const interpolatePosition = (start: { lat: number; lng: number }, end: { lat: number; lng: number }, fraction: number) => {
    return {
        lat: start.lat + (end.lat - start.lat) * fraction,
        lng: start.lng + (end.lng - start.lng) * fraction
    };
};

/**
 * Calculates bearing between two points
 * @param start - Starting {lat, lng}
 * @param end - Ending {lat, lng}
 * @returns Bearing in degrees
 */
export const calculateBearing = (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    const startLat = (start.lat * Math.PI) / 180;
    const startLng = (start.lng * Math.PI) / 180;
    const endLat = (end.lat * Math.PI) / 180;
    const endLng = (end.lng * Math.PI) / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x =
        Math.cos(startLat) * Math.sin(endLat) -
        Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
};
