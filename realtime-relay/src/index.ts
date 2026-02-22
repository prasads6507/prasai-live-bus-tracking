/**
 * Cloudflare Worker entry point — routes requests to BusRoom Durable Objects.
 *
 * Routes:
 *   GET  /health              → { ok: true }
 *   GET  /live/bus/:busId     → last known location (HTTP, no auth required)
 *   GET  /ws/bus/:busId       → WebSocket upgrade → routed to BusRoom DO
 */

import { BusRoom, type Env } from './bus-room';

// Re-export BusRoom for Durable Object binding
export { BusRoom };

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(),
            });
        }

        // Health check
        if (path === '/health') {
            return jsonResponse({ ok: true, ts: Date.now() });
        }

        // Route: GET /live/bus/:busId → HTTP fetch of last location
        const liveMatch = path.match(/^\/live\/bus\/([^/]+)$/);
        if (liveMatch) {
            const busId = liveMatch[1];
            const roomId = env.BUS_ROOM.idFromName(busId);
            const room = env.BUS_ROOM.get(roomId);

            // Forward to the DO's /location HTTP endpoint
            const doUrl = new URL(request.url);
            doUrl.pathname = '/location';
            const resp = await room.fetch(doUrl.toString());
            const data = await resp.text();

            return new Response(data, {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders(),
                },
            });
        }

        // Route: GET /ws/bus/:busId → WebSocket upgrade
        const wsMatch = path.match(/^\/ws\/bus\/([^/]+)$/);
        if (wsMatch) {
            const busId = wsMatch[1];

            // Must have Upgrade: websocket header
            if (request.headers.get('Upgrade') !== 'websocket') {
                return jsonResponse({ error: 'Expected WebSocket upgrade' }, 426);
            }

            // Route to the BusRoom Durable Object
            const roomId = env.BUS_ROOM.idFromName(busId);
            const room = env.BUS_ROOM.get(roomId);

            // Forward the request to the DO (it handles auth + WS accept)
            return room.fetch(request);
        }

        // 404 for unknown routes
        return jsonResponse(
            {
                error: 'Not found',
                routes: [
                    'GET /health',
                    'GET /live/bus/:busId',
                    'GET /ws/bus/:busId?token=...',
                ],
            },
            404
        );
    },
};

// ─── Helpers ──────────────────────────────────────────────────

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(),
        },
    });
}

function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}
