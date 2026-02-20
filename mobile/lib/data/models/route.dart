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
  final double latitude;
  final double longitude;

  RouteStop({
    required this.id,
    required this.stopName,
    required this.latitude,
    required this.longitude,
  });

  factory RouteStop.fromJson(Map<String, dynamic> json) {
    return RouteStop(
      id: json['stopId'] ?? json['_id'] ?? '',
      stopName: json['stopName'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
