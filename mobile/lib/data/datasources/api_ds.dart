import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import '../../core/config/env.dart';
import '../models/location_point.dart';

class ApiDataSource {
  final Dio _dio;
  final FirebaseFirestore _firestore;

  ApiDataSource(this._dio, this._firestore);

  Future<void> updateDriverLocation(
      String collegeId, String busId, List<LocationPoint> points) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/tracking/$busId',
      data: {
        'collegeId': collegeId,
        'points': points.map((p) => p.toJson()).toList(),
      },
    );
  }

  Future<void> startTrip(String collegeId, String busId, String driverId, String routeId) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/trip/start',
      data: {
        'collegeId': collegeId,
        'busId': busId,
        'driverId': driverId,
        'routeId': routeId,
      },
    );
  }

  Future<void> endTrip(String collegeId, String tripId) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/trip/end',
      data: {
        'collegeId': collegeId,
        'tripId': tripId,
      },
    );
  }
  Future<Map<String, dynamic>> login(String email, String password, String orgSlug) async {
    final response = await _dio.post(
      '${Env.apiUrl}/api/auth/login',
      data: {
        'email': email,
        'password': password,
        'orgSlug': orgSlug,
      },
    );
    return response.data;
  }

  Future<List<Map<String, dynamic>>> searchColleges(String query) async {
    if (query.trim().isEmpty) return [];

    try {
      // Query Firestore directly to avoid home-network IP dependencies
      final snapshot = await _firestore
          .collection('colleges')
          .where('status', isEqualTo: 'ACTIVE')
          .get();

      final results = <Map<String, dynamic>>[];
      for (var doc in snapshot.docs) {
        final data = doc.data();
        final name = data['collegeName'] as String? ?? '';
        final slug = data['slug'] as String? ?? '';
        
        if (name.toLowerCase().contains(query.toLowerCase()) || 
            slug.toLowerCase().contains(query.toLowerCase())) {
          results.add({
            'collegeId': data['collegeId'],
            'collegeName': name,
            'slug': slug,
            'status': data['status'],
          });
        }
      }
      return results;
    } catch (e) {
      print("Firestore search error: $e");
      // Fallback to API if Firestore fails (unlikely in this context)
      final response = await _dio.get(
        '${Env.apiUrl}/api/auth/colleges/search',
        queryParameters: {'q': query},
      );
      return List<Map<String, dynamic>>.from(response.data);
    }
  }
}
