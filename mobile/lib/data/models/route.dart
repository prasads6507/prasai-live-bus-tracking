import 'package:cloud_firestore/cloud_firestore.dart';

class BusRoute {
  final String id;
  final String routeName;
  final List<RouteStop> stops;

  BusRoute({
    required this.id,
    required this.routeName,
    required this.stops,
  });

  factory BusRoute.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return BusRoute(
      id: doc.id,
      routeName: data['routeName'] ?? '',
      stops: (data['stops'] as List<dynamic>?)
              ?.map((e) => RouteStop.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class RouteStop {
  final String id;
  final String stopName;
  final String address;
  final double latitude;
  final double longitude;
  final int radiusM;
  final String pickupPlannedTime;
  final String dropoffPlannedTime;
  final bool enabled;
  final int order;

  RouteStop({
    required this.id,
    required this.stopName,
    this.address = '',
    required this.latitude,
    required this.longitude,
    this.radiusM = 100,
    this.pickupPlannedTime = '',
    this.dropoffPlannedTime = '',
    this.enabled = true,
    this.order = 0,
  });

  factory RouteStop.fromJson(Map<String, dynamic> json) {
    return RouteStop(
      id: json['stopId'] ?? json['_id'] ?? '',
      stopName: json['stopName'] ?? json['name'] ?? '',
      address: json['address'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? (json['lat'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? (json['lng'] as num?)?.toDouble() ?? 0.0,
      radiusM: (json['radiusM'] as num?)?.toInt() ?? 100,
      pickupPlannedTime: json['pickupPlannedTime'] ?? '',
      dropoffPlannedTime: json['dropoffPlannedTime'] ?? '',
      enabled: json['enabled'] ?? true,
      order: (json['order'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'stopId': id,
    'name': stopName,
    'address': address,
    'lat': latitude,
    'lng': longitude,
    'latitude': latitude,
    'longitude': longitude,
    'radiusM': radiusM,
    'pickupPlannedTime': pickupPlannedTime,
    'dropoffPlannedTime': dropoffPlannedTime,
    'enabled': enabled,
    'order': order,
  };
}
