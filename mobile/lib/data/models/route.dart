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
    double parseDouble(dynamic value) {
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? 0.0;
      return 0.0;
    }

    int parseInt(dynamic value, int defaultValue) {
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    return RouteStop(
      id: json['stopId'] ?? json['_id'] ?? '',
      stopName: json['stopName'] ?? json['name'] ?? '',
      address: json['address'] ?? '',
      latitude: parseDouble(json['latitude'] ?? json['lat']),
      longitude: parseDouble(json['longitude'] ?? json['lng']),
      radiusM: parseInt(json['radiusM'], 100),
      pickupPlannedTime: json['pickupPlannedTime'] ?? '',
      dropoffPlannedTime: json['dropoffPlannedTime'] ?? '',
      enabled: json['enabled'] ?? true,
      order: parseInt(json['order'], 0),
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
