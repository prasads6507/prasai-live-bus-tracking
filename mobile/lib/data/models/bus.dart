import 'package:cloud_firestore/cloud_firestore.dart';
import 'location_point.dart';

class Bus {
  final String id;
  final String busNumber;
  final String plateNumber;
  final String status; // "ACTIVE", "IDLE", "MAINTENANCE"
  final String? activeTripId;
  final LocationPoint? location;
  final List<LocationPoint> liveTrackBuffer;
  final String? driverId;
  final String? driverName;
  final String? driverPhone;
  final String? driverEmail;
  final String? currentDriverId;
  final String? assignedRouteId;
  final List<String> completedStops;
  final String? currentRoadName;
  final double? currentSpeed;
  final double? currentHeading;

  Bus({
    required this.id,
    required this.busNumber,
    required this.plateNumber,
    required this.status,
    this.activeTripId,
    this.location,
    this.liveTrackBuffer = const [],
    this.driverId,
    this.driverName,
    this.driverPhone,
    this.driverEmail,
    this.currentDriverId,
    this.assignedRouteId,
    this.completedStops = const [],
    this.currentRoadName,
    this.currentSpeed,
    this.currentHeading,
  });

  factory Bus.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Bus(
      id: doc.id,
      busNumber: data['busNumber'] ?? '',
      plateNumber: data['plateNumber'] ?? '',
      status: data['status'] ?? 'ACTIVE',
      activeTripId: data['activeTripId'],
      location: data['location'] != null
          ? LocationPoint.fromJson(data['location'])
          : (data['currentLocation'] != null
              ? LocationPoint.fromJson({
                  'lat': data['currentLocation']['lat'],
                  'lng': data['currentLocation']['lng'],
                  'timestamp': data['lastUpdated'],
                })
              : null),
      liveTrackBuffer: (data['liveTrail'] as List<dynamic>?)
              ?.map((e) => LocationPoint.fromJson(e))
              .toList() ??
          (data['liveTrackBuffer'] as List<dynamic>?)
              ?.map((e) => LocationPoint.fromJson(e))
              .toList() ??
          [],
      driverId: data['assignedDriverId'], // Matches backend field name
      driverName: data['driverName'],
      driverPhone: data['driverPhone'],
      driverEmail: data['driverEmail'],
      currentDriverId: data['currentDriverId'],
      assignedRouteId: data['assignedRouteId'],
      completedStops: (data['completedStops'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      currentRoadName: data['currentRoadName'] ?? data['currentStreetName'],
      currentSpeed: (data['currentSpeed'] as num?)?.toDouble(),
      currentHeading: (data['currentHeading'] as num?)?.toDouble(),
    );
  }
}
