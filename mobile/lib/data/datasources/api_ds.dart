import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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
      '${Env.apiUrl}/api/driver/trip/start/$busId',
      data: {
        'collegeId': collegeId,
        'busId': busId,
        'driverId': driverId,
        'routeId': routeId,
        'tripId': 'trip-$busId-${DateTime.now().millisecondsSinceEpoch}', // Generate a tripId if not provided
      },
    );
  }

  Future<void> endTrip(String collegeId, String tripId, String busId) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/trips/$tripId/end',
      data: {
        'collegeId': collegeId,
        'busId': busId,
      },
    );
  }

  Future<void> notifyTripStarted({
    required String collegeId,
    required String busId,
    required String tripId,
    String? busNumber,
  }) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/trip-started-notify',
      data: {
        'collegeId': collegeId,
        'busId': busId,
        'tripId': tripId,
        'busNumber': busNumber,
      },
    );
  }

  Future<void> notifyTripEnded({
    required String collegeId,
    required String busId,
    required String tripId,
  }) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/trip-ended-notify',
      data: {
        'collegeId': collegeId,
        'busId': busId,
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
      // Query by collegeName prefix (case-sensitive, fast with index)
      final nameQuery = await _firestore
          .collection('colleges')
          .where('status', isEqualTo: 'ACTIVE')
          .orderBy('collegeName')
          .startAt([query.substring(0, 1).toUpperCase()])
          .endAt(['${query.substring(0, 1).toUpperCase()}\uf8ff'])
          .limit(20)
          .get();

      final results = <String, Map<String, dynamic>>{};
      
      for (var doc in nameQuery.docs) {
        final data = doc.data();
        final name = data['collegeName'] as String? ?? '';
        final slug = data['slug'] as String? ?? '';
        
        if (name.toLowerCase().contains(query.toLowerCase()) || 
            slug.toLowerCase().contains(query.toLowerCase())) {
          results[doc.id] = {
            'collegeId': data['collegeId'],
            'collegeName': name,
            'slug': slug,
            'status': data['status'],
          };
        }
      }

      // Also search by slug if few results
      if (results.length < 5) {
        final slugQuery = await _firestore
            .collection('colleges')
            .where('status', isEqualTo: 'ACTIVE')
            .where('slug', isGreaterThanOrEqualTo: query.toLowerCase())
            .where('slug', isLessThanOrEqualTo: '${query.toLowerCase()}\uf8ff')
            .limit(10)
            .get();
        
        for (var doc in slugQuery.docs) {
          final data = doc.data();
          results[doc.id] = {
            'collegeId': data['collegeId'],
            'collegeName': data['collegeName'] ?? '',
            'slug': data['slug'] ?? '',
            'status': data['status'],
          };
        }
      }

      return results.values.toList();
    } catch (e) {
      debugPrint("Firestore search error: $e");
      // Fallback to API if Firestore fails
      final response = await _dio.get(
        '${Env.apiUrl}/api/auth/colleges/search',
        queryParameters: {'q': query},
      );
      return List<Map<String, dynamic>>.from(response.data);
    }
  }

  /// Upload trip history (polyline + summary) at trip end.
  Future<void> uploadTripHistory(
    String tripId, {
    required String polyline,
    required int distanceMeters,
    required int durationSeconds,
    required int maxSpeedMph,
    required int avgSpeedMph,
    required int pointsCount,
    List<Map<String, dynamic>>? path,
  }) async {
    final data = {
      'polyline': polyline,
      'distanceMeters': distanceMeters,
      'durationSeconds': durationSeconds,
      'maxSpeedMph': maxSpeedMph,
      'avgSpeedMph': avgSpeedMph,
      'pointsCount': pointsCount,
    };
    if (path != null) data['path'] = path;

    await _dio.post(
      '${Env.apiUrl}/api/driver/trips/$tripId/history-upload',
      data: data,
    );
  }
}
