import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import '../../../data/datasources/api_ds.dart';
import '../../../core/utils/polyline_encoder.dart';

class DriverLocationService {
  static Future<void> _retryPendingUpload() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final hasPending = prefs.getBool('pending_history_upload') ?? false;
      final tripId = prefs.getString('pending_history_trip_id');
      
      if (hasPending && tripId != null) {
        debugPrint("[History] Found pending upload for trip $tripId. Retrying...");
        await uploadBufferedHistory(tripId);
      }
    } catch (e) {
      debugPrint("[History] Retry failed: $e");
    }
  }

  // startTracking and stopTracking are now handled by BackgroundTrackingService

  static Future<void> uploadBufferedHistory(String tripId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    bool uploaded = false;
    try {
      final existingBuffer = prefs.getString('trip_history_buffer');
      if (existingBuffer != null && existingBuffer.isNotEmpty) {
        final rawBuffer = List<Map<String, dynamic>>.from(jsonDecode(existingBuffer));
        if (rawBuffer.isNotEmpty) {
          // 1. Compression logic
          final List<Map<String, dynamic>> compressed = [];
          compressed.add(rawBuffer.first);

          for (int i = 1; i < rawBuffer.length - 1; i++) {
            final curr = rawBuffer[i];
            final prev = compressed.last;

            double dist = _haversineMeters(
              (prev['lat'] as num).toDouble(), (prev['lng'] as num).toDouble(),
              (curr['lat'] as num).toDouble(), (curr['lng'] as num).toDouble(),
            );

            double headingDiff = (((curr['heading'] as num?)?.toDouble() ?? 0) - 
                                 ((prev['heading'] as num?)?.toDouble() ?? 0)).abs();
            if (headingDiff > 180) headingDiff = 360 - headingDiff;

            if (dist > 10.0 || headingDiff > 15.0) {
              compressed.add(curr);
            }
          }

          if (rawBuffer.length > 1) {
            compressed.add(rawBuffer.last);
          }

          // 2. Metrics Calculation
          double totalDistM = 0;
          double maxSpeedMph = 0;
          double sumSpeedMph = 0;
          final coords = <List<double>>[];

          for (int i = 0; i < compressed.length; i++) {
            final point = compressed[i];
            final lat = (point['lat'] as num).toDouble();
            final lng = (point['lng'] as num).toDouble();
            final speed = (point['speed'] as num).toDouble();

            coords.add([lat, lng]);
            if (speed > maxSpeedMph) maxSpeedMph = speed;
            sumSpeedMph += speed;

            if (i > 0) {
              final prev = compressed[i - 1];
              totalDistM += _haversineMeters(
                (prev['lat'] as num).toDouble(), (prev['lng'] as num).toDouble(),
                lat, lng,
              );
            }
          }

          final firstTs = DateTime.parse(compressed.first['timestamp']);
          final lastTs = DateTime.parse(compressed.last['timestamp']);
          final durationSec = lastTs.difference(firstTs).inSeconds.abs();

          final String polyline = PolylineEncoder.encode(coords);

          // 3. Batch Attendance Retrieval
          final direction = prefs.getString('track_direction') ?? 'pickup';
          final attendanceList = prefs.getStringList('shared_attendance_${tripId}_$direction') ?? [];
          debugPrint("[History] Found ${attendanceList.length} attended students to upload using key: shared_attendance_${tripId}_$direction");

          // 4. Upload to API
          final dio = Dio();
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            final token = await user.getIdToken();
            if (token != null) {
              dio.options.headers['Authorization'] = 'Bearer $token';
            }
          }

          await ApiDataSource(dio, FirebaseFirestore.instance).uploadTripHistory(
            tripId,
            polyline: polyline,
            distanceMeters: totalDistM.round(),
            durationSeconds: durationSec,
            maxSpeedMph: maxSpeedMph.round(),
            avgSpeedMph: compressed.isNotEmpty ? (sumSpeedMph / compressed.length).round() : 0,
            pointsCount: compressed.length,
            path: compressed,
            attendance: attendanceList.isNotEmpty ? attendanceList : null,
          );
          
          uploaded = true;
          debugPrint("Successfully uploaded trip history for $tripId (${compressed.length} compressed points)");

          // Clear attendance after success
          await prefs.remove('shared_attendance_${tripId}_$direction');
        } else {
          // Empty buffer, consider it "done"
          uploaded = true;
        }
      } else {
        // No buffer, consider it "done"
        uploaded = true;
      }
    } catch (e) {
      debugPrint("Failed to upload buffered trip history: $e");
      // Mark as pending for retry
      await prefs.setBool('pending_history_upload', true);
      await prefs.setString('pending_history_trip_id', tripId);
    } finally {
      if (uploaded) {
        await prefs.remove('trip_history_buffer');
        await prefs.remove('trip_buffer_count');
        await prefs.remove('prev_lat');
        await prefs.remove('prev_lng');
        await prefs.remove('prev_time');
        await prefs.remove('pending_history_upload');
        await prefs.remove('pending_history_trip_id');
        debugPrint("[History] Buffer cleared for trip $tripId");
      }
    }
  }

  static double _haversineMeters(double lat1, double lon1, double lat2, double lon2) {
    const double r = 6371000; // Earth radius in meters
    final double dLat = _toRadians(lat2 - lat1);
    final double dLon = _toRadians(lon2 - lon1);
    final double a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2);
    final double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return r * c;
  }

  static double _toRadians(double degree) => degree * pi / 180;
}
