import 'dart:async';
import 'dart:collection';
import 'package:flutter/foundation.dart';
import '../../../data/models/location_point.dart';

class BusAnimationController extends ChangeNotifier {
  final Queue<LocationPoint> _animationQueue = Queue();
  
  LocationPoint? _currentRenderPoint;
  LocationPoint? _fromPoint;
  LocationPoint? _toPoint;
  
  Timer? _frameTimer;
  double _animationProgress = 0.0;
  
  // Configuration
  static const int _frameIntervalMs = 16; // ~60fps
  static const double _stepSize = _frameIntervalMs / 1000.0; // Advance 1 second in 1 second

  bool _isFollowing = true;

  LocationPoint? get currentPoint => _currentRenderPoint;
  bool get isFollowing => _isFollowing;

  void setFollowing(bool value) {
    _isFollowing = value;
    notifyListeners();
  }

  /// Adds new points to the buffer.
  void addPoints(List<LocationPoint> points) {
    if (points.isEmpty) return;

    DateTime lastTime = _animationQueue.isNotEmpty 
        ? _animationQueue.last.timestamp 
        : (_toPoint?.timestamp ?? DateTime.fromMillisecondsSinceEpoch(0));

    bool added = false;
    for (var point in points) {
      if (point.timestamp.isAfter(lastTime)) {
        _animationQueue.add(point);
        lastTime = point.timestamp;
        added = true;
      }
    }
    
    if (added && (_frameTimer == null || !_frameTimer!.isActive)) {
      _startAnimationLoop();
    }
  }

  void _startAnimationLoop() {
    _frameTimer?.cancel();
    _frameTimer = Timer.periodic(const Duration(milliseconds: _frameIntervalMs), _onFrame);
  }

  void _onFrame(Timer timer) {
    // 1. Initialize if needed
    if (_currentRenderPoint == null) {
      if (_animationQueue.isNotEmpty) {
        _currentRenderPoint = _animationQueue.first; // Snap to first
        _toPoint = _animationQueue.removeFirst();
        _fromPoint = _toPoint;
        _animationProgress = 1.0; 
      } else {
        return; // Wait for data
      }
    }

    // 2. Check if we need a new target
    if (_animationProgress >= 1.0) {
      if (_animationQueue.isNotEmpty) {
        // Move to next segment
        _fromPoint = _toPoint;
        _toPoint = _animationQueue.removeFirst();
        _animationProgress = 0.0;
      } else {
        // No new points, hold position at _toPoint
        _currentRenderPoint = _toPoint;
        // Keep timer running to catch up immediately when data arrives? 
        // Or pause? Let's keep it running for simplicity, or cancel to save CPU.
        // For "Uber-like", if data stops, we stop.
         _frameTimer?.cancel();
         notifyListeners();
        return;
      }
    }

    // 3. Interpolate
    _animationProgress += _stepSize;
    if (_animationProgress > 1.0) _animationProgress = 1.0;

    if (_fromPoint != null && _toPoint != null) {
      final lat = _lerp(_fromPoint!.latitude, _toPoint!.latitude, _animationProgress);
      final lng = _lerp(_fromPoint!.longitude, _toPoint!.longitude, _animationProgress);
      
      // Interpolate heading separately (handle 350 -> 10 deg wrapping)
      // For simplicity linear for now
      double heading = _toPoint!.heading ?? 0;
      // TODO: Better heading interpolation
      
      _currentRenderPoint = LocationPoint(
        latitude: lat,
        longitude: lng,
        timestamp: DateTime.now(), // Synthetic time
        heading: heading,
        speed: _toPoint!.speed
      );
      
      notifyListeners();
    }
  }

  double _lerp(double start, double end, double t) {
    return start + (end - start) * t;
  }

  @override
  void dispose() {
    _frameTimer?.cancel();
    super.dispose();
  }
}
