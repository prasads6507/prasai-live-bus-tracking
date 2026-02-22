/**
 * Encodes an array of [lat, lng] coordinates into a polyline string.
 * Uses the standard Google Encoded Polyline Algorithm Format.
 */
export function encodePolyline(coordinates: [number, number][], precision: number = 5): string {
    if (!coordinates.length) return '';

    const factor = Math.pow(10, precision);
    let output = '';
    let lastLat = 0;
    let lastLng = 0;

    const encode = (value: number) => {
        let chunk = value < 0 ? ~(value << 1) : value << 1;
        let str = '';
        while (chunk >= 0x20) {
            str += String.fromCharCode((0x20 | (chunk & 0x1f)) + 63);
            chunk >>= 5;
        }
        str += String.fromCharCode(chunk + 63);
        return str;
    };

    for (const [lat, lng] of coordinates) {
        const latE5 = Math.round(lat * factor);
        const lngE5 = Math.round(lng * factor);

        output += encode(latE5 - lastLat);
        output += encode(lngE5 - lastLng);

        lastLat = latE5;
        lastLng = lngE5;
    }

    return output;
}

/**
 * Decodes a polyline string into an array of [lat, lng] coordinates.
 */
export function decodePolyline(str: string, precision: number = 5): [number, number][] {
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates: [number, number][] = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision);

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = (result & 1) ? ~(result >> 1) : (result >> 1);

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}
