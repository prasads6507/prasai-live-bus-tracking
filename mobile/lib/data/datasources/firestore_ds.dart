import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/bus.dart';
import '../models/trip.dart';
import '../models/location_point.dart';
import '../models/route.dart';
import '../models/user_profile.dart';

class FirestoreDataSource {
  final FirebaseFirestore _firestore;

  FirestoreDataSource(this._firestore);

  Future<void> updateDriverLocation(
      String collegeId, String busId, List<LocationPoint> points) async {
    if (points.isEmpty) return;
    
    final lastPoint = points.last;
    final docRef = _firestore.collection('buses').doc(busId);

    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(docRef);
      if (!snapshot.exists) return;

      final data = snapshot.data() as Map<String, dynamic>?;
      if (data == null) return;

      final currentBuffer = (data['liveTrackBuffer'] as List<dynamic>?) ?? [];
      final newPointsData = points.map((p) => {
        'latitude': p.latitude,
        'longitude': p.longitude,
        'speed': p.speed ?? 0,
        'heading': p.heading ?? 0,
        'timestamp': p.timestamp?.toIso8601String() ?? DateTime.now().toIso8601String(),
      }).toList();

      final combined = [...currentBuffer, ...newPointsData];
      
      // Sort by timestamp
      combined.sort((a, b) {
        final timeA = DateTime.parse(a['timestamp'] as String).millisecondsSinceEpoch;
        final timeB = DateTime.parse(b['timestamp'] as String).millisecondsSinceEpoch;
        return timeA.compareTo(timeB);
      });

      // Trim strictly to 5 points
      final trimmedBuffer = combined.length > 5 ? combined.sublist(combined.length - 5) : combined;

      final speedMph = ((lastPoint.speed ?? 0.0) * 2.23694).round();

      final updateData = {
        'lastUpdated': DateTime.now().toIso8601String(),
        'lastLocationUpdate': FieldValue.serverTimestamp(),
        'location': {
          'latitude': lastPoint.latitude,
          'longitude': lastPoint.longitude,
          'heading': lastPoint.heading ?? 0.0,
        },
        'currentLocation': {
          'latitude': lastPoint.latitude, // Standardized key
          'longitude': lastPoint.longitude, // Standardized key
          'lat': lastPoint.latitude, // Fallback key
          'lng': lastPoint.longitude, // Fallback key
          'heading': lastPoint.heading ?? 0.0,
        },
        'speedMph': speedMph,
        'speed': speedMph,
        'currentSpeed': speedMph,
        'heading': lastPoint.heading ?? 0.0,
        'currentHeading': lastPoint.heading ?? 0.0,
        'liveTrackBuffer': trimmedBuffer,
        'status': 'ON_ROUTE',
        'trackingMode': 'NEAR_STOP',
      };

      transaction.update(docRef, updateData);
    });
  }

  /// Finds the canonical collegeId using its slug.
  /// Backend stores colleges in top-level 'colleges' collection.
  Future<String?> findCollegeIdBySlug(String slug) async {
    try {
      // 1. Try slug as Document ID
      final doc = await _firestore.collection('colleges').doc(slug).get();
      if (doc.exists) {
        final data = doc.data() as Map<String, dynamic>?;
        return data?['collegeId'] as String?;
      }

      // 2. Try slug field query
      final snapshot = await _firestore
          .collection('colleges')
          .where('slug', isEqualTo: slug)
          .limit(1)
          .get();

      if (snapshot.docs.isEmpty) return null;
      final data = snapshot.docs.first.data() as Map<String, dynamic>;
      return data['collegeId'] as String?;
    } catch (e) {
      throw 'Error finding organization "$slug": $e';
    }
  }

  Future<Bus> _populateDriverDetails(Bus bus) async {
    final activeDriverId = bus.currentDriverId ?? bus.driverId;
    if (activeDriverId == null || activeDriverId.isEmpty) return bus;
    try {
      final userDoc = await _firestore.collection('users').doc(activeDriverId).get();
      if (userDoc.exists) {
        final userData = userDoc.data() as Map<String, dynamic>;
        return Bus(
          id: bus.id,
          busNumber: bus.busNumber,
          plateNumber: bus.plateNumber,
          status: bus.status,
          activeTripId: bus.activeTripId,
          location: bus.location,
          liveTrackBuffer: bus.liveTrackBuffer,
          driverId: bus.driverId,
          driverName: userData['name'] ?? bus.driverName,
          driverPhone: userData['phone'] ?? userData['phoneNumber'] ?? bus.driverPhone,
          driverEmail: userData['email'] ?? bus.driverEmail,
          currentDriverId: bus.currentDriverId,
          assignedRouteId: bus.assignedRouteId,
          completedStops: bus.completedStops,
          currentRoadName: bus.currentRoadName,
          currentSpeed: bus.currentSpeed,
          currentHeading: bus.currentHeading,
        );
      }
    } catch (_) {}
    return bus;
  }

  /// Fetches buses for a college from the top-level 'buses' collection.
  Stream<List<Bus>> getBuses(String collegeId) {
    return _firestore
        .collection('buses')
        .where('collegeId', isEqualTo: collegeId)
        .snapshots()
        .asyncMap((snapshot) async {
          final buses = snapshot.docs.map((doc) => Bus.fromFirestore(doc)).toList();
          return Future.wait(buses.map((bus) => _populateDriverDetails(bus)));
        });
  }

  /// Fetches students for a college from the 'students' collection.
  Stream<List<UserProfile>> getStudents(String collegeId) {
    return _firestore
        .collection('students')
        .where('collegeId', isEqualTo: collegeId)
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) => UserProfile.fromFirestore(doc)).toList());
  }

  /// Fetches buses assigned to a specific driver.
  Stream<List<Bus>> getDriverBuses(String collegeId, String driverId) {
    return _firestore
        .collection('buses')
        .where('collegeId', isEqualTo: collegeId)
        .where('assignedDriverId', isEqualTo: driverId)
        .snapshots()
        .asyncMap((snapshot) async {
          final buses = snapshot.docs.map((doc) => Bus.fromFirestore(doc)).toList();
          return Future.wait(buses.map((bus) => _populateDriverDetails(bus)));
        });
  }

  /// Updates the live buffer in the top-level 'buses' collection.
  /// Modified to match Web Portal field names for parity.
  Future<void> updateBusLiveBuffer(
    String collegeId,
    String busId,
    List<LocationPoint> points, {
    String? roadName,
    double? speed,
  }) async {
    final lastPoint = points.last;
    await _firestore.collection('buses').doc(busId).update({
      'liveTrail': points.map((p) => {
        'lat': p.latitude,
        'lng': p.longitude,
        'timestamp': p.timestamp?.toIso8601String() ?? DateTime.now().toIso8601String(),
      }).toList(),
      'location': {
        'latitude': lastPoint.latitude,
        'longitude': lastPoint.longitude,
        'heading': lastPoint.heading ?? 0.0,
      },
      'currentLocation': {
        'latitude': lastPoint.latitude,
        'longitude': lastPoint.longitude,
        'lat': lastPoint.latitude,
        'lng': lastPoint.longitude,
        'heading': lastPoint.heading ?? 0.0,
      },
      'lastLocationUpdate': FieldValue.serverTimestamp(),
      'currentRoadName': roadName,
      'currentStreetName': roadName,
      'currentSpeed': speed,
      'speed': speed,
      'speedMph': speed,
      'heading': lastPoint.heading ?? 0.0,
      'currentHeading': lastPoint.heading ?? 0.0,
      'lastUpdated': DateTime.now().toIso8601String(),
      'status': 'ON_ROUTE',
      'trackingMode': 'NEAR_STOP',
    });
  }
  /// Updates the bus's road/street name
  Future<void> updateBusRoadName(String busId, String roadName) async {
    await _firestore.collection('buses').doc(busId).update({
      'currentRoadName': roadName,
      'currentStreetName': roadName,
    });
  }
  /// Saves a single point to the trip path array (1 trip = 1 doc).
  Future<void> saveTripPathPoint(String tripId, LocationPoint point, String busId) async {
    try {
      final tripRef = _firestore.collection('trips').doc(tripId);
      final newPoint = {
        'lat': point.latitude,
        'lng': point.longitude,
        'latitude': point.latitude,
        'longitude': point.longitude,
        'heading': point.heading ?? 0.0,
        'speed': ((point.speed ?? 0.0) * 2.23694).round(),
        'timestamp': DateTime.now().toIso8601String(),
        'recordedAt': DateTime.now().toIso8601String(),
      };
      await tripRef.update({
        'path': FieldValue.arrayUnion([newPoint]),
        'totalPoints': FieldValue.increment(1),
      });
    } catch (e) {
      print('Error saving trip history point: $e');
    }
  }

  /// Bulk-writes all GPS points to a trip doc in ONE Firestore update.
  /// Called at trip end — zero writes during the trip.
  Future<void> bulkSaveTripPath(String tripId, List<LocationPoint> points) async {
    if (points.isEmpty) return;
    try {
      final tripRef = _firestore.collection('trips').doc(tripId);

      final pathData = points.map((p) {
        final speedMph = ((p.speed ?? 0.0) * 2.23694).round();
        return {
          'lat': p.latitude,
          'lng': p.longitude,
          'latitude': p.latitude,
          'longitude': p.longitude,
          'heading': p.heading ?? 0.0,
          'speed': speedMph,
          'timestamp': p.timestamp?.toIso8601String() ?? DateTime.now().toIso8601String(),
          'recordedAt': p.timestamp?.toIso8601String() ?? DateTime.now().toIso8601String(),
        };
      }).toList();

      // Calculate distance and max speed
      double totalDistanceM = 0.0;
      double maxSpeedMph = 0.0;
      for (int i = 1; i < points.length; i++) {
        final prev = points[i - 1];
        final curr = points[i];
        final dLat = (curr.latitude - prev.latitude) * 111320;
        final cosLat = _cosRad(prev.latitude * 3.14159265 / 180.0);
        final dLng = (curr.longitude - prev.longitude) * 111320 * cosLat;
        totalDistanceM += _sqrtNewton(dLat * dLat + dLng * dLng);
        final sMph = (curr.speed ?? 0.0) * 2.23694;
        if (sMph > maxSpeedMph) maxSpeedMph = sMph;
      }

      await tripRef.update({
        'path': pathData,
        'totalPoints': points.length,
        'distanceMeters': totalDistanceM.round(),
        'maxSpeedMph': maxSpeedMph.round(),
      });

      print('[BulkSave] ${points.length} pts → trip $tripId (${totalDistanceM.round()}m, max ${maxSpeedMph.round()} mph)');
    } catch (e) {
      print('Error bulk saving trip path: $e');
    }
  }

  static double _cosRad(double x) => 1.0 - (x * x / 2.0) + (x * x * x * x / 24.0);
  static double _sqrtNewton(double x) {
    if (x <= 0) return 0;
    double g = x / 2;
    for (int i = 0; i < 10; i++) g = (g + x / g) / 2;
    return g;
  }

  /// Searches for buses by bus number within a college.
  Future<List<Bus>> searchBusesByNumber(String collegeId, String query) async {
    // Search by busNumber
    final numSnapshot = await _firestore
        .collection('buses')
        .where('collegeId', isEqualTo: collegeId)
        .where('busNumber', isGreaterThanOrEqualTo: query)
        .where('busNumber', isLessThanOrEqualTo: query + '\uf8ff')
        .get();
    
    // Search by plateNumber
    final plateSnapshot = await _firestore
        .collection('buses')
        .where('collegeId', isEqualTo: collegeId)
        .where('plateNumber', isGreaterThanOrEqualTo: query.toUpperCase())
        .where('plateNumber', isLessThanOrEqualTo: query.toUpperCase() + '\uf8ff')
        .get();

    final busses = <String, Bus>{};
    for (var doc in numSnapshot.docs) {
      busses[doc.id] = await _populateDriverDetails(Bus.fromFirestore(doc));
    }
    for (var doc in plateSnapshot.docs) {
      busses[doc.id] = await _populateDriverDetails(Bus.fromFirestore(doc));
    }

    return busses.values.toList();
  }

  /// Stream of a specific bus from the top-level 'buses' collection.
  Stream<Bus> getBus(String collegeId, String busId) {
    return _firestore
        .collection('buses')
        .doc(busId)
        .snapshots()
        .asyncMap((doc) async => await _populateDriverDetails(Bus.fromFirestore(doc)));
  }

  /// Checks if a user exists in either 'users' or 'students' top-level collections.
  Future<DocumentSnapshot> getUserInCollege(String collegeId, String uid) async {
    // 1. Try 'users' collection (Admins, Drivers)
    DocumentSnapshot? doc;
    try {
      doc = await _firestore.collection('users').doc(uid).get();
      if (doc.exists) {
        final data = doc.data() as Map<String, dynamic>?;
        if (data != null && data['collegeId'] == collegeId) return doc;
      }
    } catch (e) {
      print('Error checking users collection: $e');
    }
    
    // 2. Try 'students' collection (Direct ID lookup)
    try {
      doc = await _firestore.collection('students').doc(uid).get();
      if (doc.exists) {
        final data = doc.data() as Map<String, dynamic>?;
        if (data != null && data['collegeId'] == collegeId) return doc;
      }
    } catch (e) {
      print('Error checking students collection: $e');
    }
    
    // 3. Final fallback: search by field
    try {
      final snap = await _firestore.collection('students')
          .where('collegeId', isEqualTo: collegeId)
          .where('studentId', isEqualTo: uid)
          .limit(1).get();
          
      if (snap.docs.isNotEmpty) return snap.docs.first;
    } catch (e) {
      print('Error in final student fallback: $e');
    }

    throw 'User record not found for UID: $uid in college: $collegeId. Please check registration status.';
  }

  Stream<Trip?> getActiveTrip(String collegeId, String busId) {
    return _firestore
        .collection('trips')
        .where('collegeId', isEqualTo: collegeId)
        .where('busId', isEqualTo: busId)
        .snapshots()
        .map((snapshot) {
      if (snapshot.docs.isEmpty) return null;
      // Find the first document with status 'active' or 'ACTIVE'
      final activeDoc = snapshot.docs.where((doc) {
        final status = (doc.data()['status'] ?? '').toString().toLowerCase();
        return status == 'active' || status == 'on_route';
      }).firstOrNull;
      
      if (activeDoc == null) return null;
      return Trip.fromFirestore(activeDoc);
    });
  }

  /// Fetches a route by ID from top-level 'routes' collection.
  Future<BusRoute?> getRoute(String routeId) async {
    try {
      final doc = await _firestore.collection('routes').doc(routeId).get();
      if (doc.exists) {
        return BusRoute.fromFirestore(doc);
      }
      return null;
    } catch (e) {
      print('Error fetching route $routeId: $e');
      return null;
    }
  }

  /// Fetches all routes for a specific college, including stops from the stops collection
  Future<List<BusRoute>> getCollegeRoutes(String collegeId) async {
    final routeSnapshot = await _firestore.collection('routes')
        .where('collegeId', isEqualTo: collegeId)
        .get();

    final List<BusRoute> routes = [];
    for (final doc in routeSnapshot.docs) {
      // Load stops from the separate stops collection
      final stopsSnapshot = await _firestore.collection('stops')
          .where('routeId', isEqualTo: doc.id)
          .get();

      final stops = stopsSnapshot.docs
          .map((s) => RouteStop.fromJson(s.data()))
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));

      final data = doc.data();
      routes.add(BusRoute(
        id: doc.id,
        routeName: data['routeName'] ?? '',
        stops: stops,
      ));
    }
    return routes;
  }

  /// Starts a new trip and updates the bus status.
  /// [direction] is 'pickup' or 'dropoff'. Dropoff reverses stop order.
  Future<String> startTrip({
    required String collegeId,
    required String busId,
    required String driverId,
    required String routeId,
    String? busNumber,
    String? driverName,
    String direction = 'pickup',
  }) async {
    final batch = _firestore.batch();
    
    // Generate trip ID
    final tripId = 'trip-${busId}-${DateTime.now().millisecondsSinceEpoch}';

    // Load stops from Firestore
    List<RouteStop> stops = [];
    if (routeId.isNotEmpty) {
      final stopsSnapshot = await _firestore.collection('stops')
          .where('routeId', isEqualTo: routeId)
          .get();
      stops = stopsSnapshot.docs
          .map((s) => RouteStop.fromJson(s.data()))
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));

      if (direction == 'dropoff') {
        stops = stops.reversed.toList();
      }
    }

    // Build stopsSnapshot for the trip
    final stopsSnapshot = stops.asMap().entries.map((entry) {
      final idx = entry.key;
      final stop = entry.value;
      return {
        'stopId': stop.id,
        'order': idx + 1,
        'name': stop.stopName,
        'address': stop.address,
        'lat': stop.latitude,
        'lng': stop.longitude,
        'latitude': stop.latitude,
        'longitude': stop.longitude,
        'radiusM': stop.radiusM,
        'plannedTime': direction == 'dropoff' ? stop.dropoffPlannedTime : stop.pickupPlannedTime,
        'enabled': stop.enabled,
      };
    }).toList();

    // Build initial stopProgress and eta
    final firstStopId = stopsSnapshot.isNotEmpty ? stopsSnapshot[0]['stopId'] : null;
    final stopProgress = {
      'currentIndex': 0,
      'arrivedStopIds': <String>[],
      'arrivals': <String, String>{},
    };
    final eta = {
      'nextStopId': firstStopId,
      'nextStopEta': null,
      'perStopEta': <String, String>{},
      'delayMinutes': 0,
    };
    
    final tripData = {
      'tripId': tripId,
      'collegeId': collegeId,
      'busId': busId,
      'busNumber': busNumber ?? 'Unknown',
      'driverId': driverId,
      'driverName': driverName ?? 'Unknown Driver',
      'routeId': routeId,
      'direction': direction,
      'status': 'ACTIVE',
      'isActive': true,
      'startedAt': FieldValue.serverTimestamp(),
      'startTime': DateTime.now().toIso8601String(),
      'createdAt': FieldValue.serverTimestamp(),
      'totalPoints': 0,
      'path': [],
      'stopsSnapshot': stopsSnapshot,
      'stopProgress': stopProgress,
      'eta': eta,
    };

    // 1. Write to ROOT trips collection (canonical source for portal & path data)
    final rootTripRef = _firestore.collection('trips').doc(tripId);
    batch.set(rootTripRef, tripData);

    // 2. Also write to bus subcollection (backward compatibility)
    final subTripRef = _firestore.collection('buses').doc(busId).collection('trips').doc(tripId);
    batch.set(subTripRef, tripData);
    
    // 3. Update Bus Status
    final busRef = _firestore.collection('buses').doc(busId);
    batch.update(busRef, {
      'status': 'ON_ROUTE',
      'activeTripId': tripId,
      'currentTripId': tripId,
      'routeId': routeId,
      'driverName': driverName ?? 'Unknown Driver',
      'currentDriverId': driverId,
      'currentRoadName': 'Ready to start...',
      'completedStops': [],
      'liveTrackBuffer': [],
      'lastUpdated': DateTime.now().toIso8601String(),
      'lastLocationUpdate': FieldValue.serverTimestamp(),
    });
    
    await batch.commit();
    return tripId;
  }

  /// Ends an active trip and resets the bus status.
  /// If tripId is null, it still resets the bus status to recover from "stuck" states.
  Future<void> endTrip(String? tripId, String busId) async {
    try {
      final batch = _firestore.batch();
      
      // 1. Update Trip Status in BOTH locations (if ID provided)
      if (tripId != null && tripId.isNotEmpty) {
        int? durationMinutes;

        // Try root collection first for startTime
        final rootTripRef = _firestore.collection('trips').doc(tripId);
        final rootTripDoc = await rootTripRef.get();

        // Also reference the subcollection doc
        final subTripRef = _firestore.collection('buses').doc(busId).collection('trips').doc(tripId);
        final subTripDoc = await subTripRef.get();

        // Get startTime from whichever doc exists
        final data = rootTripDoc.exists ? rootTripDoc.data() : (subTripDoc.exists ? subTripDoc.data() : null);
        if (data != null) {
          final startTimeStr = data['startTime'] as String?;
          if (startTimeStr != null) {
            try {
              final start = DateTime.parse(startTimeStr);
              final end = DateTime.now();
              durationMinutes = end.difference(start).inMinutes;
            } catch (e) {
              print('Error parsing startTime: $e');
            }
          }
        }

        final endUpdate = {
          'status': 'COMPLETED',
          'endedAt': FieldValue.serverTimestamp(),
          'endTime': DateTime.now().toIso8601String(),
          'isActive': false,
          'durationMinutes': durationMinutes,
        };

        // Update root trip doc
        if (rootTripDoc.exists) {
          batch.update(rootTripRef, endUpdate);
        }

        // Update subcollection trip doc
        if (subTripDoc.exists) {
          batch.update(subTripRef, endUpdate);
        }
      }
      
      // 2. Reset Bus Status
      final busRef = _firestore.collection('buses').doc(busId);
      final busDoc = await busRef.get();
      if (busDoc.exists) {
        batch.update(busRef, {
          'status': 'ACTIVE',
          'activeTripId': null,
          'currentTripId': null,
          'currentRoadName': '',
          'currentStreetName': '',
          'currentSpeed': 0,
          'speed': 0,
          'completedStops': [],
          'liveTrackBuffer': [],
          'liveTrail': [],
          'lastUpdated': DateTime.now().toIso8601String(),
        });
      }
      
      await batch.commit();
    } catch (e) {
      print('Error ending trip: $e');
      // If batch fails, try a direct update on the bus to at least unlock it
      try {
        await _firestore.collection('buses').doc(busId).update({
          'status': 'ACTIVE',
          'activeTripId': null,
          'currentTripId': null,
        });
      } catch (e2) {
        print('Fallback reset failed: $e2');
      }
      rethrow;
    }
  }

  /// Toggles a bus as favorite for a student/user.
  /// Enforces single-favorite: clears all existing favorites before adding the new one.
  Future<void> toggleFavoriteBus(String uid, String busId, bool isFavorite) async {
    final studentRef = _firestore.collection('students').doc(uid);
    final userRef = _firestore.collection('users').doc(uid);
    
    final studentDoc = await studentRef.get();
    final docRef = studentDoc.exists ? studentRef : userRef;

    if (isFavorite) {
      // Single favorite: replace all with the new one
      await docRef.update({
        'favoriteBusIds': [busId]
      });
    } else {
      await docRef.update({
        'favoriteBusIds': FieldValue.arrayRemove([busId])
      });
    }
  }

  /// Streams user profile for real-time updates (favorites, etc.)
  Stream<UserProfile?> streamUserProfile(String collegeId, String uid) {
    // Try students collection first, then users
    return _firestore.collection('students').doc(uid).snapshots().asyncMap((studentDoc) async {
      if (studentDoc.exists) {
        final data = studentDoc.data() as Map<String, dynamic>?;
        if (data != null && data['collegeId'] == collegeId) {
          return UserProfile.fromFirestore(studentDoc);
        }
      }
      // Fallback to users collection
      final userDoc = await _firestore.collection('users').doc(uid).get();
      if (userDoc.exists) {
        final data = userDoc.data() as Map<String, dynamic>?;
        if (data != null && data['collegeId'] == collegeId) {
          return UserProfile.fromFirestore(userDoc);
        }
      }
      return null;
    });
  }
}
