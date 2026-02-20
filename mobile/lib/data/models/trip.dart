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

  factory Trip.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Trip(
      id: doc.id,
      busId: data['busId'] ?? '',
      driverId: data['driverId'] ?? '',
      routeId: data['routeId'] ?? '',
      status: data['status'] ?? 'active',
      startedAt: (data['startedAt'] as Timestamp).toDate(),
      endedAt: (data['endedAt'] as Timestamp?)?.toDate(),
    );
  }
}
