import 'package:cloud_firestore/cloud_firestore.dart';

class UserProfile {
  final String id;
  final String email;
  final String role; // "student", "driver", "admin"
  final String collegeId;
  final String? name;
  final String? phone;
  final String? assignedBusId;
  final List<String> favoriteBusIds;

  UserProfile({
    required this.id,
    required this.email,
    required this.role,
    required this.collegeId,
    this.name,
    this.phone,
    this.assignedBusId,
    this.favoriteBusIds = const [],
  });

  factory UserProfile.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return UserProfile(
      id: doc.id,
      email: data['email'] ?? '',
      role: data['role'] ?? 'student',
      collegeId: data['collegeId'] ?? '',
      name: data['name'],
      phone: (data['phone'] ?? data['phoneNumber'])?.toString(),
      assignedBusId: (data['busId'] ?? data['assignedBusId'])?.toString(),
      favoriteBusIds: List<String>.from(data['favoriteBusIds'] ?? []),
    );
  }
}
