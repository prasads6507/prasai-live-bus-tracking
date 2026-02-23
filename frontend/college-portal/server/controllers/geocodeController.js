const axios = require('axios');

/**
 * Proxy geocoding requests to OpenStreetMap Nominatim
 * This bypasses browser CORS restrictions and prevents exposing client IP directly
 */
exports.reverseGeocode = async (req, res) => {
    try {
        const { lat, lon, lng } = req.query;

        // Support both lon and lng query params
        const longitude = lon || lng;

        if (!lat || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and Longitude are required'
            });
        }

        const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${longitude}&format=json&zoom=16`,
            {
                headers: {
                    'User-Agent': 'BannuBusApp/1.0 (Bannu IT Department)'
                },
                timeout: 5000 // 5 second timeout
            }
        );

        res.json({
            success: true,
            address: response.data.address || {}
        });

    } catch (error) {
        console.error('[Geocode Controller] Reverse geocoding failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to geocode location',
            error: error.message
        });
    }
};
