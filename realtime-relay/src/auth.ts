/**
 * HMAC-SHA256 token verification for Cloudflare Workers.
 * Tokens are minted by the Firebase backend and verified here
 * without any network calls to Firebase.
 */

export interface TokenPayload {
    sub: string;      // userId
    role: 'driver' | 'admin' | 'student';
    busId: string;
    collegeId: string;
    exp: number;      // Unix timestamp (seconds)
}

/**
 * Encode a string to Uint8Array (UTF-8).
 */
function encodeUtf8(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * Convert ArrayBuffer to hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBuffer(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Base64url encode a string (no padding).
 */
function base64urlEncode(str: string): string {
    const bytes = encodeUtf8(str);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode to string.
 */
function base64urlDecode(b64: string): string {
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

/**
 * Create HMAC-SHA256 signature.
 */
async function hmacSign(secret: string, data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        encodeUtf8(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encodeUtf8(data));
    return bufferToHex(sig);
}

/**
 * Verify HMAC-SHA256 signature using constant-time comparison.
 */
async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
    const key = await crypto.subtle.importKey(
        'raw',
        encodeUtf8(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );
    const sigBytes = hexToBuffer(signature);
    return crypto.subtle.verify('HMAC', key, sigBytes, encodeUtf8(data));
}

/**
 * Create a relay token (used by the backend — included here for reference/testing).
 */
export async function createToken(secret: string, payload: TokenPayload): Promise<string> {
    const payloadStr = base64urlEncode(JSON.stringify(payload));
    const sig = await hmacSign(secret, payloadStr);
    return `${payloadStr}.${sig}`;
}

/**
 * Verify and decode a relay token.
 * Returns the payload if valid, or null if invalid/expired.
 */
export async function verifyToken(secret: string, token: string): Promise<TokenPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [payloadB64, signature] = parts;

        // Verify HMAC signature
        const valid = await hmacVerify(secret, payloadB64, signature);
        if (!valid) return null;

        // Decode payload
        const payload: TokenPayload = JSON.parse(base64urlDecode(payloadB64));

        // Check expiry
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < nowSec) return null;

        return payload;
    } catch {
        return null;
    }
}
