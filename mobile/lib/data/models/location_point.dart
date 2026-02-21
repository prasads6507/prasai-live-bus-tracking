import 'package:cloud_firestore/cloud_firestore.dart';

class LocationPoint {
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final double? heading;
  final double? speed;

  LocationPoint({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.heading,
    this.speed,
  });

  factory LocationPoint.fromJson(Map<String, dynamic> json) {
    DateTime time;
    if (json['tMillis'] != null) {
      time = DateTime.fromMillisecondsSinceEpoch(json['tMillis'] as int);
    } else if (json['timestamp'] is Timestamp) {
      time = (json['timestamp'] as Timestamp).toDate();
    } else if (json['timestamp'] != null) {
      time = DateTime.parse(json['timestamp'].toString());
    } else {
      time = DateTime.now(); // Fallback
    }

    return LocationPoint(
      latitude: ((json['latitude'] ?? json['lat']) as num).toDouble(),
      longitude: ((json['longitude'] ?? json['lng']) as num).toDouble(),
      timestamp: time,
      heading: (json['heading'] as num?)?.toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      'tMillis': timestamp.millisecondsSinceEpoch,
      'heading': heading,
      'speed': speed,
    };
  }

  factory LocationPoint.fromMap(Map<String, dynamic> map) => LocationPoint.fromJson(map);

  Map<String, dynamic> toMap() => toJson();
}
