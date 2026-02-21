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
          duration: const Duration(milliseconds: 4500),
        )..addListener(onTick);

  void updateTarget(LocationPoint point) {
    if (_lastPoint == null) {
      _lastPoint = point;
      _targetPoint = point;
      return;
    }

    _lastPoint = currentInterpolated; // Start from where we are currently rendered
    _targetPoint = point;
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
