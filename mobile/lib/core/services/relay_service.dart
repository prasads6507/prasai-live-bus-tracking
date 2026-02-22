import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;

/// WebSocket relay service for streaming driver GPS to Cloudflare.
/// Handles connection management, auto-reconnect, and message
/// sending/receiving in both foreground and background isolates.
class RelayService {
  WebSocketChannel? _channel;
  String _wsUrl = '';
  bool _isIntentionalClose = false;
  int _reconnectAttempts = 0;
  Timer? _reconnectTimer;
  Timer? _pingTimer;

  /// Callbacks
  void Function(Map<String, dynamic>)? onMessage;
  void Function()? onOpen;
  void Function()? onClose;
  void Function(dynamic)? onError;

  /// Maximum reconnect attempts before giving up.
  final int maxReconnectAttempts;

  /// Base delay for reconnect backoff (ms).
  final int reconnectBaseDelayMs;

  bool get isConnected => _channel != null;

  RelayService({
    this.maxReconnectAttempts = 10,
    this.reconnectBaseDelayMs = 1000,
  });

  /// Connect to a WebSocket relay URL.
  void connect(String wsUrl) {
    _wsUrl = wsUrl;
    _isIntentionalClose = false;
    _reconnectAttempts = 0;
    _doConnect();
  }

  void _doConnect() {
    try {
      _channel?.sink.close(status.normalClosure);
    } catch (_) {}

    try {
      final uri = Uri.parse(_wsUrl);
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String) as Map<String, dynamic>;

            if (data['type'] == 'connected') {
              print('[Relay] Connected: ${data['role']} for bus ${data['busId']}');
              onOpen?.call();
              _startPingTimer();
            } else {
              onMessage?.call(data);
            }
          } catch (e) {
            print('[Relay] Failed to parse message: $e');
          }
        },
        onDone: () {
          print('[Relay] Connection closed');
          _stopPingTimer();
          onClose?.call();
          if (!_isIntentionalClose) {
            _scheduleReconnect();
          }
        },
        onError: (error) {
          print('[Relay] Error: $error');
          _stopPingTimer();
          onError?.call(error);
          if (!_isIntentionalClose) {
            _scheduleReconnect();
          }
        },
      );
    } catch (e) {
      print('[Relay] Failed to connect: $e');
      _scheduleReconnect();
    }
  }

  void _startPingTimer() {
    _stopPingTimer();
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      send({'type': 'ping'});
    });
  }

  void _stopPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= maxReconnectAttempts) {
      print('[Relay] Max reconnect attempts reached');
      return;
    }

    final delay = Duration(
      milliseconds: (reconnectBaseDelayMs * (1 << _reconnectAttempts))
          .clamp(0, 30000),
    );

    print('[Relay] Reconnecting in ${delay.inMilliseconds}ms '
        '(attempt ${_reconnectAttempts + 1}/$maxReconnectAttempts)');

    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      _doConnect();
    });
  }

  /// Send a JSON message.
  bool send(Map<String, dynamic> data) {
    if (_channel == null) return false;
    try {
      _channel!.sink.add(jsonEncode(data));
      return true;
    } catch (e) {
      print('[Relay] Send failed: $e');
      return false;
    }
  }

  /// Send a driver location update.
  bool sendLocation({
    required String tripId,
    required double lat,
    required double lng,
    required double speedMps,
    required double heading,
    double accuracyM = 0,
  }) {
    return send({
      'type': 'driver_location',
      'tripId': tripId,
      'lat': lat,
      'lng': lng,
      'speedMps': speedMps,
      'heading': heading,
      'accuracyM': accuracyM,
      'ts': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Disconnect from the relay.
  void disconnect() {
    _isIntentionalClose = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _stopPingTimer();
    try {
      _channel?.sink.close(status.normalClosure, 'Client disconnect');
    } catch (_) {}
    _channel = null;
    print('[Relay] Disconnected');
  }

  /// Dispose all resources.
  void dispose() {
    disconnect();
  }
}
