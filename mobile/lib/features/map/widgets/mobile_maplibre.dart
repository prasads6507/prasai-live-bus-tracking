import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'dart:typed_data';
import 'dart:ui' as dart_ui;

import '../../../../core/theme/colors.dart';

import '../../../../data/models/bus.dart';
import '../../../../data/models/location_point.dart';
import '../../../../data/providers.dart';
import '../logic/map_animation_ticker.dart';

class MobileMapLibre extends ConsumerStatefulWidget {
  final String collegeId;
  final String? selectedBusId;
  final bool followBus;
  final List<List<double>>? path; // [lat, lng]
  final LocationPoint? focusedLocation;
  final bool showStudentLocation;
  final LocationPoint? studentLocation;
  final List<Map<String, dynamic>>? stopCircles; // [{lat, lng, radiusM, name}]
  final String? nextStopId;
  final List<String>? arrivedStopIds;
  final List<String>? completedStopIds;
  final List<String>? skippedStopIds;
  final LocationPoint? liveBusLocation; // For high-freq websocket updates

  const MobileMapLibre({
    super.key,
    required this.collegeId,
    this.selectedBusId,
    this.followBus = true,
    this.path,
    this.focusedLocation,
    this.showStudentLocation = false,
    this.studentLocation,
    this.stopCircles,
    this.nextStopId,
    this.arrivedStopIds,
    this.completedStopIds,
    this.skippedStopIds,
    this.liveBusLocation,
  });

  @override
  ConsumerState<MobileMapLibre> createState() => _MobileMapLibreState();
}

class _MobileMapLibreState extends ConsumerState<MobileMapLibre> with SingleTickerProviderStateMixin {
  MaplibreMapController? _mapController;
  late MapAnimationTicker _animationTicker;
  StreamSubscription<List<Bus>>? _busesSubscription;
  List<Bus> _currentBuses = [];
  bool _styleLoaded = false;
  bool _studentLayerAdded = false;

  final String _busIconId = 'bus-icon';

  @override
  void didUpdateWidget(MobileMapLibre oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // High-frequency live override for the selected bus
    if (widget.liveBusLocation != null && 
        widget.liveBusLocation?.timestamp != oldWidget.liveBusLocation?.timestamp &&
        widget.selectedBusId != null) {
      final latLngPath = widget.path?.map((p) => LatLng(p[0], p[1])).toList();
      _animationTicker.updateTarget(widget.liveBusLocation!, expectedIntervalSec: 5, path: latLngPath); 
    }

    // Jump to focused location if provided and updated
    if (widget.focusedLocation != null && 
        oldWidget.focusedLocation?.timestamp != widget.focusedLocation?.timestamp &&
        _mapController != null && _styleLoaded) {
      _mapController!.animateCamera(
         CameraUpdate.newCameraPosition(
           CameraPosition(
             target: LatLng(widget.focusedLocation!.latitude, widget.focusedLocation!.longitude),
             zoom: 17.0,
           )
         ),
         duration: const Duration(milliseconds: 1500),
      );
    }

    // Update student location marker
    if (widget.showStudentLocation && 
        widget.studentLocation != null &&
        _styleLoaded && _mapController != null) {
      _updateStudentLocation();
    }

    // Update stop layers when circles or status changes
    if (_styleLoaded && _mapController != null && 
        (widget.stopCircles != oldWidget.stopCircles || 
         widget.nextStopId != oldWidget.nextStopId || 
         widget.arrivedStopIds != oldWidget.arrivedStopIds ||
         widget.completedStopIds != oldWidget.completedStopIds ||
         widget.skippedStopIds != oldWidget.skippedStopIds)) {
      _updateStopLayers();
    }
  }

  @override
  void initState() {
    super.initState();
    _animationTicker = MapAnimationTicker(
      vsync: this,
      onTick: _onAnimationTick,
    );
  }

  @override
  void dispose() {
    _animationTicker.dispose();
    _busesSubscription?.cancel();
    super.dispose();
  }

  void _onMapCreated(MaplibreMapController controller) {
    _mapController = controller;
  }

  Future<void> _onStyleLoaded() async {
    if (_mapController == null) return;
    try {
      // 1. Load Assets
      final busImg = await _createIcon(Icons.directions_bus_outlined, AppColors.primary, 120); 
      if (busImg != null) await _mapController!.addImage(_busIconId, busImg);
      
      final stopImg = await _createIcon(Icons.location_on, const Color(0xFFEF4444), 60); // red marker
      if (stopImg != null) await _mapController!.addImage('stop-icon', stopImg);

      // 2. Add Sources
      await _mapController!.addGeoJsonSource('buses-source', _buildBusesGeoJson(_currentBuses));
      await _mapController!.addGeoJsonSource('selected-pointer-source', _buildSelectedPointerGeoJson(null));

      // 3. Add Layers
      // Background pointer pulse for selected bus
      await _mapController!.addCircleLayer(
        'selected-pointer-source',
        'selected-pointer-layer',
        CircleLayerProperties(
          circleRadius: 24.0,
          circleColor: '#3b82f6',
          circleOpacity: 0.3,
          circleBlur: 0.5,
        ),
      );

      // Bus Icons Layer
      await _mapController!.addSymbolLayer(
        'buses-source',
        'buses-layer',
        SymbolLayerProperties(
          iconImage: _busIconId,
          iconSize: 0.8,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconRotate: ['get', 'heading'], 
          iconPitchAlignment: 'map',
          iconRotationAlignment: 'map',
        ),
      );

      // 4. Add Student Location Layer (blue circle with 50m radius)
    if (widget.showStudentLocation) {
      await _addStudentLocationLayer();
    }

    // 5. Add Stop Geofence Circles (100m radius)
    if (widget.stopCircles != null && widget.stopCircles!.isNotEmpty) {
      await _addStopCircleLayers();
    }

    _styleLoaded = true;
    _subscribeToBuses();

    // Update student location if already available
    if (widget.studentLocation != null && widget.showStudentLocation) {
      _updateStudentLocation();
    }

  } catch (e) {
    debugPrint("Error loading MapLibre style resources: $e");
  }
}

  Future<void> _addStopCircleLayers() async {
    if (_mapController == null || widget.stopCircles == null) return;
    try {
      final features = widget.stopCircles!.map((stop) {
        return {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [
              (stop['lng'] as num?)?.toDouble() ?? 0.0,
              (stop['lat'] as num?)?.toDouble() ?? 0.0,
            ]
          },
          "properties": {
            "name": stop['name'] ?? '',
            "radiusM": stop['radiusM'] ?? 100,
          }
        };
      }).toList();

      await _mapController!.addGeoJsonSource('stop-circles-source', {
        "type": "FeatureCollection",
        "features": features,
      });

      // 100m geofence circle (orange, semi-transparent)
      await _mapController!.addCircleLayer(
        'stop-circles-source',
        'stop-circles-layer',
        CircleLayerProperties(
          circleRadius: 60.0, // Approximate 100m at zoom 17
          circleColor: '#f97316',
          circleOpacity: 0.12,
          circleStrokeColor: '#f97316',
          circleStrokeWidth: 1.5,
          circleStrokeOpacity: 0.5,
        ),
      );

      // Stop pin marker
      await _mapController!.addSymbolLayer(
        'stop-circles-source',
        'stop-pins-layer',
        SymbolLayerProperties(
          iconImage: 'stop-icon',
          iconSize: 0.8,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconAnchor: 'bottom',
        ),
      );
    } catch (e) {
      debugPrint("Error adding stop circle layers: $e");
    }
  }

  Future<void> _updateStopLayers() async {
    if (_mapController == null || widget.stopCircles == null || !_styleLoaded) return;
    try {
      final features = widget.stopCircles!.map((stop) {
        final stopId = stop['id'] ?? stop['stopId'] ?? stop['_id'] ?? '';
        final isNext = widget.nextStopId == stopId;
        final isArrived = widget.arrivedStopIds?.contains(stopId) ?? false;
        final isCompleted = widget.completedStopIds?.contains(stopId) ?? false;
        final isSkipped = widget.skippedStopIds?.contains(stopId) ?? false;
        
        String status = 'UPCOMING';
        if (isCompleted) status = 'COMPLETED';
        else if (isSkipped) status = 'SKIPPED';
        else if (isArrived) status = 'ARRIVED';
        else if (isNext) status = 'NEXT';

        return {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [
              (stop['lng'] as num?)?.toDouble() ?? 0.0,
              (stop['lat'] as num?)?.toDouble() ?? 0.0,
            ]
          },
          "properties": {
            "name": stop['name'] ?? '',
            "radiusM": stop['radiusM'] ?? 100,
            "status": status,
            "isNext": isNext,
          }
        };
      }).toList();

      await _mapController!.setGeoJsonSource('stop-circles-source', {
        "type": "FeatureCollection",
        "features": features,
      });
    } catch (e) {
      debugPrint("Error updating stop layers: $e");
    }
  }

  Future<void> _addStudentLocationLayer() async {
    if (_mapController == null || _studentLayerAdded) return;
    
    try {
      await _mapController!.addGeoJsonSource('student-location-source', {
        "type": "FeatureCollection",
        "features": []
      });

      // 50m radius circle (blue, semi-transparent)
      await _mapController!.addCircleLayer(
        'student-location-source',
        'student-radius-layer',
        CircleLayerProperties(
          circleRadius: 30.0, // Approximate 50m at zoom 17
          circleColor: '#3b82f6',
          circleOpacity: 0.15,
          circleStrokeColor: '#3b82f6',
          circleStrokeWidth: 2.0,
          circleStrokeOpacity: 0.4,
        ),
      );

      // Student pin (solid blue dot)
      await _mapController!.addCircleLayer(
        'student-location-source',
        'student-pin-layer',
        CircleLayerProperties(
          circleRadius: 8.0,
          circleColor: '#3b82f6',
          circleOpacity: 0.9,
          circleStrokeColor: '#ffffff',
          circleStrokeWidth: 3.0,
        ),
      );

      _studentLayerAdded = true;
    } catch (e) {
      debugPrint("Error adding student location layer: $e");
    }
  }

  void _updateStudentLocation() {
    if (!_styleLoaded || _mapController == null || widget.studentLocation == null) return;

    if (!_studentLayerAdded) {
      _addStudentLocationLayer().then((_) => _updateStudentLocation());
      return;
    }

    _mapController!.setGeoJsonSource('student-location-source', {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [widget.studentLocation!.longitude, widget.studentLocation!.latitude]
          },
          "properties": {}
        }
      ]
    });
  }

  void _subscribeToBuses() {
    if (!_styleLoaded) return;
    
    _busesSubscription?.cancel();
    _busesSubscription = ref.read(firestoreDataSourceProvider)
        .getBuses(widget.collegeId)
        .listen((buses) {
      _currentBuses = buses;
      _updateSources();

      if (widget.selectedBusId != null && widget.followBus) {
        final selectedBus = buses.where((b) => b.id == widget.selectedBusId).firstOrNull;
        if (selectedBus?.location != null) {
            final loc = selectedBus!.location!;
            final latLngPath = widget.path?.map((p) => LatLng(p[0], p[1])).toList();
            _animationTicker.updateTarget(LocationPoint(
               latitude: loc.latitude,
               longitude: loc.longitude,
               speed: selectedBus.currentSpeed,
               heading: selectedBus.currentHeading ?? loc.heading ?? 0,
               timestamp: DateTime.now(),
            ), expectedIntervalSec: selectedBus.trackingMode == 'NEAR_STOP' ? 5 : 20, path: latLngPath);
        }
      }
    });
  }

  void _onAnimationTick() {
    if (!_styleLoaded || _mapController == null) return;
    
    final interpolated = _animationTicker.currentInterpolated;
    if (interpolated != null) {
      _mapController!.setGeoJsonSource('selected-pointer-source', _buildSelectedPointerGeoJson(interpolated));
      _updateSources(); // Update the main buses source to use interpolated coords
      
      if (widget.followBus) {
        _mapController!.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(
              target: LatLng(interpolated.latitude, interpolated.longitude),
              zoom: 17.0,
            )
          ),
          duration: const Duration(milliseconds: 300),
        );
      }
    }
  }

  void _updateSources() {
    if (!_styleLoaded || _mapController == null) return;
    _mapController!.setGeoJsonSource('buses-source', _buildBusesGeoJson(_currentBuses));
  }

  Map<String, dynamic> _buildBusesGeoJson(List<Bus> buses) {
    List<Map<String, dynamic>> features = [];
    for (var bus in buses) {
      if (bus.location == null) continue;
      
      final isSelected = bus.id == widget.selectedBusId;
      var lat = bus.location!.latitude;
      var lng = bus.location!.longitude;
      var heading = bus.currentHeading ?? bus.location!.heading ?? 0;

      if (isSelected && _animationTicker.currentInterpolated != null) {
         lat = _animationTicker.currentInterpolated!.latitude;
         lng = _animationTicker.currentInterpolated!.longitude;
         heading = _animationTicker.currentInterpolated!.heading ?? heading;
      }

      features.add({
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [lng, lat]
        },
        "properties": {
          "id": bus.id,
          "busNumber": bus.busNumber,
          "heading": heading,
          "status": bus.status,
        }
      });
    }

    return {
      "type": "FeatureCollection",
      "features": features,
    };
  }

  Map<String, dynamic> _buildSelectedPointerGeoJson(LocationPoint? point) {
    if (point == null || widget.selectedBusId == null) {
      return {
        "type": "FeatureCollection",
        "features": []
      };
    }

    return {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [point.longitude, point.latitude]
          },
          "properties": {
             "heading": point.heading ?? 0,
          }
        }
      ]
    };
  }


  Future<Uint8List?> _createIcon(IconData iconData, Color color, double size) async {
    try {
      final pictureRecorder = dart_ui.PictureRecorder();
      final canvas = Canvas(pictureRecorder);
      final textPainter = TextPainter(textDirection: TextDirection.ltr);

      // Background circle
      final paint = Paint()..color = Colors.white..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(size / 2, size / 2), size / 2.2, paint);
      
      final shadowPaint = Paint()
        ..color = Colors.black.withOpacity(0.15)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8.0);
      canvas.drawCircle(Offset(size / 2, size / 2 + 4), size / 2.2, shadowPaint);
      // Redraw white circle over shadow
      canvas.drawCircle(Offset(size / 2, size / 2), size / 2.2, paint);

      final iconStr = String.fromCharCode(iconData.codePoint);
      textPainter.text = TextSpan(
        text: iconStr,
        style: TextStyle(
          letterSpacing: 0.0,
          fontSize: size * 0.6,
          fontFamily: iconData.fontFamily,
          package: iconData.fontPackage,
          color: color,
        ),
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset((size - textPainter.width) / 2, (size - textPainter.height) / 2),
      );

      final picture = pictureRecorder.endRecording();
      final image = await picture.toImage(size.toInt(), size.toInt());
      final byteData = await image.toByteData(format: dart_ui.ImageByteFormat.png);
      return byteData?.buffer.asUint8List();
    } catch (e) {
      debugPrint("Failed to create canvas icon: $e");
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Default to student location or a neutral fallback (0,0 triggers myLocationEnabled)
    CameraPosition initialCamera;
    
    if (widget.focusedLocation != null) {
      initialCamera = CameraPosition(
        target: LatLng(widget.focusedLocation!.latitude, widget.focusedLocation!.longitude),
        zoom: 17.0,
      );
    } else if (widget.studentLocation != null) {
      initialCamera = CameraPosition(
        target: LatLng(widget.studentLocation!.latitude, widget.studentLocation!.longitude),
        zoom: 15.0,
      );
    } else {
      // Use myLocationEnabled to auto-center — this is better than hardcoding Hyderabad
      initialCamera = const CameraPosition(
        target: LatLng(40.0, -83.0), // Neutral fallback (Columbus, OH area)
        zoom: 13.0,
        tilt: 0,
        bearing: 0,
      );
    }

    return MaplibreMap(
      onMapCreated: _onMapCreated,
      onStyleLoadedCallback: _onStyleLoaded,
      initialCameraPosition: initialCamera,
      styleString: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      rotateGesturesEnabled: false,
      tiltGesturesEnabled: false,
      trackCameraPosition: true,
      myLocationEnabled: true,
    );
  }
}
