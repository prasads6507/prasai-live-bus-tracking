import 'package:cloud_firestore/cloud_firestore.dart';

class UserNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final String? otp;
  final String? tripId;
  final bool read;
  final DateTime createdAt;

  UserNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    this.otp,
    this.tripId,
    required this.read,
    required this.createdAt,
  });

  factory UserNotification.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return UserNotification(
      id: doc.id,
      title: data['title'] ?? '',
      body: data['body'] ?? '',
      type: data['type'] ?? '',
      otp: data['otp'],
      tripId: data['tripId'],
      read: data['read'] ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'body': body,
      'type': type,
      'otp': otp,
      'tripId': tripId,
      'read': read,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }
}
