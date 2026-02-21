import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'dart:typed_data';

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

  const MobileMapLibre({
    super.key,
    required this.collegeId,
    this.selectedBusId,
    this.followBus = true,
    this.path,
    this.focusedLocation,
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

  final String _busIconId = 'bus-icon';
  final String _selectedPointerId = 'selected-pointer';

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
      final busImg = await _loadAsset('assets/bus_pin.png'); 
      if (busImg != null) await _mapController!.addImage(_busIconId, busImg);
      
      // We can also create a fallback circle pointer image or use the same asset for selected pointer
      // For now, let's just use the bus pin for everything, we'll size it differently.

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
          iconSize: 0.25,
          iconAllowOverlap: true,
          iconIgnorePlacement: true,
          iconRotate: ['get', 'heading'], 
          iconPitchAlignment: 'map',
          iconRotationAlignment: 'map',
        ),
      );

      _styleLoaded = true;
      _subscribeToBuses();

    } catch (e) {
      debugPrint("Error loading MapLibre style resources: $e");
    }
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
            _animationTicker.updateTarget(LocationPoint(
               latitude: loc.latitude,
               longitude: loc.longitude,
               speed: selectedBus.currentSpeed,
               heading: selectedBus.currentHeading ?? loc.heading ?? 0,
               timestamp: DateTime.now(),
            ));
        }
      }
    });
  }

  void _onAnimationTick() {
    if (!_styleLoaded || _mapController == null) return;
    
    final interpolated = _animationTicker.currentInterpolated;
    if (interpolated != null) {
      _mapController!.setGeoJsonSource('selected-pointer-source', _buildSelectedPointerGeoJson(interpolated));
      
      if (widget.followBus) {
        _mapController!.moveCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(
              target: LatLng(interpolated.latitude, interpolated.longitude),
              zoom: 17.0, // Fixed zoom 17 for tracking
            )
          )
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
      // Filter if we want to show only active buses, 
      // but matching web: we show all that have locations.
      
      final isSelected = bus.id == widget.selectedBusId;
      if (isSelected && _animationTicker.currentInterpolated != null) {
         // The selected bus will use the interpolated position via the pointer layer,
         // but we can also update the main layer if needed. For now, we update main layer with snap data.
      }

      features.add({
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [bus.location!.longitude, bus.location!.latitude]
        },
        "properties": {
          "id": bus.id,
          "busNumber": bus.busNumber,
          "heading": bus.currentHeading ?? bus.location!.heading ?? 0,
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

  Future<Uint8List?> _loadAsset(String path) async {
    try {
      final ByteData bytes = await rootBundle.load(path);
      return bytes.buffer.asUint8List();
    } catch (e) {
      debugPrint("Failed to load asset $path: $e");
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    CameraPosition initialCamera = CameraPosition(
      target: LatLng(17.3850, 78.4867),
      zoom: 13.0,
      tilt: 0,
      bearing: 0,
    );

    if (widget.focusedLocation != null) {
      initialCamera = CameraPosition(
        target: LatLng(widget.focusedLocation!.latitude, widget.focusedLocation!.longitude),
        zoom: 17.0,
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
    );
  }
}
