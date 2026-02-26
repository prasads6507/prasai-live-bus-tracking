/**
 * BusRoom Durable Object — one instance per bus.
 *
 * Responsibilities:
 * - Accept WebSocket connections from driver (publisher) and watchers (admin/student)
 * - Store lastLocation in memory
 * - Throttle broadcasts to max 1/second
 * - Broadcast bus_location_update to all watchers
 */

import { verifyToken, type TokenPayload } from './auth';

interface ClientInfo {
    role: 'driver' | 'admin' | 'student';
    userId: string;
    busId: string;
    collegeId: string;
}

interface LocationData {
    busId: string;
    tripId?: string;
    lat: number;
    lng: number;
    speedMps?: number;
    speedMph?: number;
    heading?: number;
    accuracyM?: number;
    ts: number;
    serverTs?: number;
}

export class BusRoom {
    private state: DurableObjectState;
    private env: Env;
    private clients: Map<WebSocket, ClientInfo> = new Map();
    private lastLocation: LocationData | null = null;
    private lastBroadcastTime: number = 0;
    private pendingBroadcast: LocationData | null = null;
    private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;

        // Restore any hibernated WebSockets
        this.state.getWebSockets().forEach((ws) => {
            const meta = ws.deserializeAttachment() as ClientInfo | null;
            if (meta) {
                this.clients.set(ws, meta);
            }
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // HTTP endpoint for last known location
        if (url.pathname === '/location') {
            return new Response(
                JSON.stringify(this.lastLocation || { error: 'no_data' }),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': this.env.CORS_ORIGIN || '*',
                    },
                }
            );
        }

        // WebSocket upgrade
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected WebSocket', { status: 426 });
        }

        // Extract and verify token
        const token = url.searchParams.get('token');
        if (!token) {
            return new Response('Missing token', { status: 401 });
        }

        const secret = this.env.RELAY_HMAC_SECRET;
        const payload = await verifyToken(secret, token);
        if (!payload) {
            return new Response('Invalid or expired token', { status: 401 });
        }

        // Extract busId from URL path
        const pathParts = url.pathname.split('/');
        const busIdFromUrl = pathParts[pathParts.length - 1] || '';

        // Verify token busId matches the room
        if (payload.busId !== busIdFromUrl && busIdFromUrl !== '') {
            return new Response('Token busId mismatch', { status: 403 });
        }

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = [pair[0], pair[1]];

        const clientInfo: ClientInfo = {
            role: payload.role,
            userId: payload.sub,
            busId: payload.busId,
            collegeId: payload.collegeId,
        };

        // Accept the WebSocket with hibernation support
        this.state.acceptWebSocket(server);
        server.serializeAttachment(clientInfo);
        this.clients.set(server, clientInfo);

        // Send current location immediately if available
        if (this.lastLocation) {
            server.send(
                JSON.stringify({
                    type: 'bus_location_update',
                    ...this.lastLocation,
                    serverTs: Date.now(),
                })
            );
        }

        // Send connection acknowledgment
        server.send(
            JSON.stringify({
                type: 'connected',
                role: payload.role,
                busId: payload.busId,
                clientCount: this.clients.size,
            })
        );

        return new Response(null, { status: 101, webSocket: client });
    }

    /**
     * Handle incoming WebSocket messages (Hibernation API).
     */
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        const info = this.clients.get(ws);
        if (!info) {
            ws.close(4001, 'Unknown client');
            return;
        }

        try {
            const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
            const data = JSON.parse(msgStr);

            switch (data.type) {
                case 'driver_location':
                    // Only drivers can send location updates
                    if (info.role !== 'driver') {
                        ws.send(JSON.stringify({ type: 'error', message: 'Only drivers can send location' }));
                        return;
                    }
                    this.handleDriverLocation(data, info);
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
                    break;

                default:
                    ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    }

    /**
     * Handle WebSocket close (Hibernation API).
     */
    async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
        this.clients.delete(ws);
    }

    /**
     * Handle WebSocket error (Hibernation API).
     */
    async webSocketError(ws: WebSocket, error: unknown) {
        this.clients.delete(ws);
    }

    /**
     * Process a driver location update.
     * Stores the location and schedules a throttled broadcast.
     */
    private handleDriverLocation(data: any, info: ClientInfo) {
        // Accept speedMps (preferred) OR speedMph as fallback — never let speed be 0 due to wrong unit
        let speedMps = Math.max(0, data.speedMps || 0);
        if (speedMps === 0 && data.speedMph) {
            speedMps = Math.max(0, data.speedMph) / 2.23694;
        }
        const speedMph = Math.round(speedMps * 2.23694);

        const location: LocationData = {
            busId: info.busId,
            tripId: data.tripId,
            lat: data.lat,
            lng: data.lng,
            speedMps,
            speedMph,
            heading: data.heading || 0,
            accuracyM: data.accuracyM || 0,
            ts: data.ts || Date.now(),
            serverTs: Date.now(),
        };

        // Always store the latest location
        this.lastLocation = location;

        // Throttle broadcasts to max 1 per second
        const now = Date.now();
        const elapsed = now - this.lastBroadcastTime;

        if (elapsed >= 1000) {
            // Enough time has passed, broadcast immediately
            this.broadcastToWatchers(location);
            this.lastBroadcastTime = now;
            this.pendingBroadcast = null;
        } else {
            // Store pending and schedule delayed broadcast
            this.pendingBroadcast = location;
            if (!this.broadcastTimer) {
                const delay = 1000 - elapsed;
                this.broadcastTimer = setTimeout(() => {
                    this.broadcastTimer = null;
                    if (this.pendingBroadcast) {
                        this.broadcastToWatchers(this.pendingBroadcast);
                        this.lastBroadcastTime = Date.now();
                        this.pendingBroadcast = null;
                    }
                }, delay);
            }
        }
    }

    /**
     * Broadcast a location update to all connected watchers (admin + student).
     * Also sends to the driver for round-trip confirmation.
     */
    private broadcastToWatchers(location: LocationData) {
        const message = JSON.stringify({
            type: 'bus_location_update',
            ...location,
        });

        for (const [ws, info] of this.clients) {
            try {
                ws.send(message);
            } catch {
                // Client disconnected — will be cleaned up via webSocketClose
                this.clients.delete(ws);
            }
        }
    }
}

// Environment interface
export interface Env {
    BUS_ROOM: DurableObjectNamespace;
    RELAY_HMAC_SECRET: string;
    TOKEN_TTL_SECONDS: string;
    CORS_ORIGIN?: string;
}
