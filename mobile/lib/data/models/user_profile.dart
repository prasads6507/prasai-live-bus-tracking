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
  final String? activeBusId;
  final String? activeBusNumber;
  final DateTime? lastBusUpdate;

  UserProfile({
    required this.id,
    required this.email,
    required this.role,
    required this.collegeId,
    this.name,
    this.phone,
    this.assignedBusId,
    this.favoriteBusIds = const [],
    this.activeBusId,
    this.activeBusNumber,
    this.lastBusUpdate,
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
      activeBusId: data['activeBusId']?.toString(),
      activeBusNumber: data['activeBusNumber']?.toString(),
      lastBusUpdate: data['lastBusUpdate'] is Timestamp 
        ? (data['lastBusUpdate'] as Timestamp).toDate() 
        : (data['lastBusUpdate'] != null ? DateTime.tryParse(data['lastBusUpdate'].toString()) : null),
    );
  }

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      email: json['email'] ?? '',
      role: json['role'] ?? 'student',
      collegeId: json['collegeId'] ?? '',
      name: json['name'],
      phone: (json['phone'] ?? json['phoneNumber'])?.toString(),
      assignedBusId: (json['assignedBusId'] ?? json['busId'])?.toString(),
      favoriteBusIds: List<String>.from(json['favoriteBusIds'] ?? []),
      activeBusId: json['activeBusId']?.toString(),
      activeBusNumber: json['activeBusNumber']?.toString(),
      lastBusUpdate: json['lastBusUpdate'] != null ? DateTime.tryParse(json['lastBusUpdate'].toString()) : null,
    );
  }
}
