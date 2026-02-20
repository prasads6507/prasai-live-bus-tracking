import 'dart:async';
import '../../../data/models/location_point.dart';
import '../../../data/repositories/tracking_repo.dart';

class TrackingBatcher {
  final TrackingRepository _trackingRepository;
  final String _collegeId;
  final String _busId;
  final List<LocationPoint> _buffer = [];
  Timer? _timer;

  TrackingBatcher(this._trackingRepository, this._collegeId, this._busId);

  void start() {
    _timer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _flush();
    });
  }

  void addPoint(LocationPoint point) {
    _buffer.add(point);
  }

  Future<void> stop() async {
    _timer?.cancel();
    await _flush();
  }

  Future<void> _flush() async {
    if (_buffer.isEmpty) return;

    final pointsToSend = List<LocationPoint>.from(_buffer);
    _buffer.clear();

    try {
      await _trackingRepository.updateBusLiveBuffer(_collegeId, _busId, pointsToSend);
      // Also send to API/DB for history/logging if needed
      await _trackingRepository.updateDriverLocation(_collegeId, _busId, pointsToSend);
    } catch (e) {
      print('Failed to send tracking update: $e');
    }
  }
}
