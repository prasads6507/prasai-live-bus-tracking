import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../../../../data/models/location_point.dart';
import 'dart:math';
import 'package:geolocator/geolocator.dart';

/// Interpolates smoothly between previous location and current moving point.
/// Uses ease-out curve for more natural movement and shortest-path heading interpolation.
class MapAnimationTicker {
  final AnimationController _controller;
  LocationPoint? _lastPoint;
  LocationPoint? _targetPoint;
  List<LatLng>? _currentPath;

  MapAnimationTicker({
    required TickerProvider vsync,
    required VoidCallback onTick,
  }) : _controller = AnimationController(
          vsync: vsync,
          duration: const Duration(seconds: 5), // default
        )..addListener(onTick);

  void updateTarget(LocationPoint point, {int expectedIntervalSec = 5, List<LatLng>? path}) {
    _currentPath = path;
    final now = DateTime.now();
    final pointTime = point.timestamp;
    final ageSec = now.difference(pointTime).inSeconds;
    
    // Staleness check
    bool isStale = ageSec > 120;
    
    if (_lastPoint == null || isStale) {
      _lastPoint = point;
      _targetPoint = point;
      _controller.duration = const Duration(milliseconds: 100);
      _controller.forward(from: 0.0);
      return;
    }

    _lastPoint = currentInterpolated; // Start from where we are currently rendered
    _targetPoint = point;
    
    int animDuration = (expectedIntervalSec * 1000 * 0.95).round();
    _controller.duration = Duration(milliseconds: animDuration);
    
    _controller.forward(from: 0.0);
  }

  LocationPoint? get currentInterpolated {
    if (_lastPoint == null || _targetPoint == null) return _targetPoint;
    
    final t = Curves.easeOut.transform(_controller.value);
    
    // Linear interpolation for lat/lng
    double lat = _lastPoint!.latitude + (_targetPoint!.latitude - _lastPoint!.latitude) * t;
    double lng = _lastPoint!.longitude + (_targetPoint!.longitude - _lastPoint!.longitude) * t;
    
    // Route Snapping
    if (_currentPath != null && _currentPath!.isNotEmpty) {
      final snapped = _snapToPath(LatLng(lat, lng), _currentPath!);
      lat = snapped.latitude;
      lng = snapped.longitude;
    }

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

  LatLng _snapToPath(LatLng point, List<LatLng> path) {
    if (path.isEmpty) return point;
    
    LatLng closest = path.first;
    double minDist = double.infinity;

    for (int i = 0; i < path.length - 1; i++) {
      LatLng p1 = path[i];
      LatLng p2 = path[i + 1];
      LatLng projected = _getClosestPointOnSegment(point, p1, p2);
      
      // Fast rough distance check before expensive geolocator call if needed
      // Actually, geolocator is fine for 20-50 segments
      double d = Geolocator.distanceBetween(
        point.latitude, point.longitude, 
        projected.latitude, projected.longitude
      );
      
      if (d < minDist) {
        minDist = d;
        closest = projected;
      }
    }

    // Only snap if within 200m to allow for intentional off-route movement/parking
    return minDist < 200 ? closest : point;
  }

  LatLng _getClosestPointOnSegment(LatLng p, LatLng p1, LatLng p2) {
    double x = p.longitude;
    double y = p.latitude;
    double x1 = p1.longitude;
    double y1 = p1.latitude;
    double x2 = p2.longitude;
    double y2 = p2.latitude;

    double dx = x2 - x1;
    double dy = y2 - y1;

    if (dx == 0 && dy == 0) return p1;

    double t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);

    if (t < 0) return p1;
    if (t > 1) return p2;

    return LatLng(y1 + t * dy, x1 + t * dx);
  }

  void dispose() {
    _controller.dispose();
  }
}
