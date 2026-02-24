import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../../../../data/models/location_point.dart';
import 'dart:math';

/// Interpolates smoothly between previous location and current moving point.
/// Uses ease-out curve for more natural movement and shortest-path heading interpolation.
class MapAnimationTicker {
  final AnimationController _controller;
  LocationPoint? _lastPoint;
  LocationPoint? _targetPoint;

  MapAnimationTicker({
    required TickerProvider vsync,
    required VoidCallback onTick,
  }) : _controller = AnimationController(
          vsync: vsync,
          duration: const Duration(seconds: 5), // default
        )..addListener(onTick);

  void updateTarget(LocationPoint point, {int expectedIntervalSec = 5}) {
    // If it's stale (e.g. > 120s), we jump without interpolating slowly
    final now = DateTime.now();
    final pointTime = point.timestamp;
    final ageSec = now.difference(pointTime).inSeconds;
    
    // Staleness check
    bool isStale = ageSec > 120;
    
    if (_lastPoint == null || isStale) {
      _lastPoint = point;
      _targetPoint = point;
      // snap instantly if fresh initialization or stale jump
      _controller.duration = const Duration(milliseconds: 100);
      _controller.forward(from: 0.0);
      return;
    }

    _lastPoint = currentInterpolated; // Start from where we are currently rendered
    _targetPoint = point;
    
    // Dynamically set animation length to span smoothly
    // A bit faster than the interval to ensure it completes before next update
    int animDuration = (expectedIntervalSec * 1000 * 0.95).round();
    _controller.duration = Duration(milliseconds: animDuration);
    
    _controller.forward(from: 0.0);
  }

  LocationPoint? get currentInterpolated {
    if (_lastPoint == null || _targetPoint == null) return _targetPoint;
    
    // Use ease-out curve for smoother deceleration
    final t = Curves.easeOut.transform(_controller.value);
    
    // Linear interpolation for lat/lng
    final lat = _lastPoint!.latitude + (_targetPoint!.latitude - _lastPoint!.latitude) * t;
    final lng = _lastPoint!.longitude + (_targetPoint!.longitude - _lastPoint!.longitude) * t;
    
    // Shortest-path interpolation for heading
    double h1 = _lastPoint!.heading ?? 0;
    double h2 = _targetPoint!.heading ?? h1;
    double diff = h2 - h1;
    while (diff < -180.0) diff += 360.0;
    while (diff > 180.0) diff -= 360.0;
    final heading = h1 + diff * t;

    return LocationPoint(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.now(),
      heading: heading,
      speed: _targetPoint!.speed,
    );
  }

  void dispose() {
    _controller.dispose();
  }
}
