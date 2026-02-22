/**
 * WebSocket Relay Service for connecting to the Cloudflare WebSocket relay.
 * Handles connection management, auto-reconnect, and message handling.
 */

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface RelayConfig {
    onMessage?: MessageHandler;
    onOpen?: ConnectionHandler;
    onClose?: ConnectionHandler;
    onError?: (error: Event) => void;
    maxReconnectAttempts?: number;
    reconnectBaseDelay?: number;
}

class RelayService {
    private ws: WebSocket | null = null;
    private wsUrl: string = '';
    private config: RelayConfig = {};
    private reconnectAttempts: number = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isIntentionalClose: boolean = false;

    /**
     * Connect to the WebSocket relay.
     */
    connect(wsUrl: string, config: RelayConfig = {}): void {
        this.wsUrl = wsUrl;
        this.config = {
            maxReconnectAttempts: 10,
            reconnectBaseDelay: 1000,
            ...config,
        };
        this.isIntentionalClose = false;
        this.reconnectAttempts = 0;
        this._connect();
    }

    private _connect(): void {
        if (this.ws) {
            try { this.ws.close(); } catch (_) { }
        }

        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('[Relay] Connected to', this.wsUrl);
                this.reconnectAttempts = 0;
                this.config.onOpen?.();
            };

            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    this.config.onMessage?.(data);
                } catch (err) {
                    console.warn('[Relay] Failed to parse message:', event.data);
                }
            };

            this.ws.onclose = (event: CloseEvent) => {
                console.log('[Relay] Connection closed', event.code, event.reason);
                this.config.onClose?.();

                if (!this.isIntentionalClose) {
                    this._scheduleReconnect();
                }
            };

            this.ws.onerror = (event: Event) => {
                console.error('[Relay] WebSocket error');
                this.config.onError?.(event);
            };
        } catch (err) {
            console.error('[Relay] Failed to create WebSocket:', err);
            this._scheduleReconnect();
        }
    }

    private _scheduleReconnect(): void {
        const max = this.config.maxReconnectAttempts || 10;
        if (this.reconnectAttempts >= max) {
            console.warn('[Relay] Max reconnect attempts reached');
            return;
        }

        const delay = Math.min(
            (this.config.reconnectBaseDelay || 1000) * Math.pow(2, this.reconnectAttempts),
            30000 // Max 30 seconds
        );

        console.log(`[Relay] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${max})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this._connect();
        }, delay);
    }

    /**
     * Send a JSON message over the WebSocket.
     */
    send(data: any): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[Relay] Cannot send — WebSocket not open');
            return false;
        }

        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (err) {
            console.error('[Relay] Send failed:', err);
            return false;
        }
    }

    /**
     * Send a driver location update.
     */
    sendLocation(data: {
        tripId: string;
        lat: number;
        lng: number;
        speedMps: number;
        heading: number;
        accuracyM?: number;
    }): boolean {
        return this.send({
            type: 'driver_location',
            ...data,
            ts: Date.now(),
        });
    }

    /**
     * Check if connected.
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Disconnect from the relay.
     */
    disconnect(): void {
        this.isIntentionalClose = true;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            try {
                this.ws.close(1000, 'Client disconnect');
            } catch (_) { }
            this.ws = null;
        }

        console.log('[Relay] Disconnected');
    }
}

// Singleton instance for the driver app connection
const relayService = new RelayService();

export default relayService;
export { RelayService };
