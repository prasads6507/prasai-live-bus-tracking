/**
 * Relay Token Controller
 * 
 * Mints HMAC-signed tokens for WebSocket relay authentication.
 * Tokens are short-lived (10 min) and verified by the Cloudflare Worker
 * without any network calls back to Firebase.
 */
const crypto = require('crypto');

const HMAC_SECRET = process.env.RELAY_HMAC_SECRET || 'default-dev-secret-change-me';
const TOKEN_TTL = parseInt(process.env.RELAY_TOKEN_TTL_SECONDS || '600', 10); // 10 minutes

/**
 * Base64url encode (no padding).
 */
function base64urlEncode(str) {
    return Buffer.from(str, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Create HMAC-SHA256 signature as hex string.
 */
function hmacSign(data) {
    return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

/**
 * Create a relay token.
 */
function createRelayToken(payload) {
    const payloadStr = base64urlEncode(JSON.stringify(payload));
    const sig = hmacSign(payloadStr);
    return `${payloadStr}.${sig}`;
}

/**
 * @desc    Mint a relay token for WebSocket access
 * @route   POST /api/relay/token
 * @access  Private (any authenticated user)
 */
const getRelayToken = async (req, res) => {
    try {
        const { busId, role } = req.body;

        if (!busId) {
            return res.status(400).json({ success: false, message: 'busId is required' });
        }

        if (!role || !['driver', 'admin', 'student'].includes(role)) {
            return res.status(400).json({ success: false, message: 'role must be driver, admin, or student' });
        }

        const userId = req.user.id;
        const collegeId = req.collegeId;

        // Authorization checks
        if (role === 'driver') {
            // Verify driver is assigned to this bus
            const { db } = require('../config/firebase');
            const busDoc = await db.collection('buses').doc(busId).get();
            if (!busDoc.exists) {
                return res.status(404).json({ success: false, message: 'Bus not found' });
            }
            const busData = busDoc.data();
            if (busData.collegeId !== collegeId) {
                return res.status(403).json({ success: false, message: 'Bus not in your college' });
            }
        }

        // Create token payload
        const nowSec = Math.floor(Date.now() / 1000);
        const payload = {
            sub: userId,
            role,
            busId,
            collegeId,
            exp: nowSec + TOKEN_TTL,
        };

        const token = createRelayToken(payload);
        const relayWsUrl = process.env.RELAY_WS_URL || '';

        res.status(200).json({
            success: true,
            token,
            wsUrl: `${relayWsUrl}/ws/bus/${busId}?token=${token}`,
            expiresIn: TOKEN_TTL,
        });
    } catch (error) {
        console.error('Error creating relay token:', error);
        res.status(500).json({ success: false, message: 'Failed to create relay token' });
    }
};

module.exports = {
    getRelayToken,
    createRelayToken,
};
