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
    String? driverId,
    String? routeId,
    bool isMaintenance = false,
    String? originalBusId,
  }) async {
    await _dio.post(
      '${Env.apiUrl}/api/driver/trip-started-notify',
      data: {
        'collegeId': collegeId,
        'busId': busId,
        'tripId': tripId,
        'busNumber': busNumber,
        'driverId': driverId,
        'routeId': routeId,
        'isMaintenance': isMaintenance,
        'originalBusId': originalBusId,
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
      // Query Firestore directly without complex ordering to avoid composite index requirements
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
      debugPrint("Firestore search error: $e");
      // Fallback to API if Firestore fails
      try {
        final response = await _dio.get(
          '${Env.apiUrl}/api/auth/colleges/search',
          queryParameters: {'q': query},
        );
        final collegesList = response.data['colleges'] as List<dynamic>? ?? [];
        return List<Map<String, dynamic>>.from(collegesList);
      } catch (apiErr) {
        debugPrint("API search fallback error: $apiErr");
        return [];
      }
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
