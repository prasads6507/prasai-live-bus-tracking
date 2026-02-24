import 'package:cloud_firestore/cloud_firestore.dart';

class Trip {
  final String id;
  final String busId;
  final String driverId;
  final String routeId;
  final String status; // "active", "ended"
  final DateTime startedAt;
  final DateTime? endedAt;

  Trip({
    required this.id,
    required this.busId,
    required this.driverId,
    required this.routeId,
    required this.status,
    required this.startedAt,
    this.endedAt,
  });

  static DateTime _parseDate(dynamic value, [DateTime? fallback]) {
    if (value == null) return fallback ?? DateTime.now();
    if (value is Timestamp) return value.toDate();
    if (value is String) return DateTime.tryParse(value) ?? (fallback ?? DateTime.now());
    return fallback ?? DateTime.now();
  }

  factory Trip.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Trip(
      id: doc.id,
      busId: data['busId'] ?? '',
      driverId: data['driverId'] ?? '',
      routeId: data['routeId'] ?? '',
      status: data['status'] ?? 'ACTIVE',
      startedAt: _parseDate(data['startedAt'] ?? data['startTime']),
      endedAt: data['endedAt'] != null || data['endTime'] != null ? _parseDate(data['endedAt'] ?? data['endTime']) : null,
    );
  }
}
