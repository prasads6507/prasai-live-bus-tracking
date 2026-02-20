import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'datasources/api_ds.dart';
import 'datasources/auth_ds.dart';
import 'datasources/firestore_ds.dart';
import 'repositories/auth_repo.dart';
import 'repositories/bus_repo.dart';
import 'repositories/tracking_repo.dart';
import 'repositories/trip_repo.dart';
import 'repositories/user_repo.dart';
import 'models/bus.dart';
import 'models/user_profile.dart';

// External Services
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);
final dioProvider = Provider<Dio>((ref) => Dio());

// Authentication state stream
final authStateProvider = StreamProvider<User?>((ref) {
  final authRepository = ref.watch(authRepositoryProvider);
  return authRepository.authStateChanges;
});

// Internal State
final selectedCollegeIdProvider = StateProvider<String?>((ref) => null);
final selectedCollegeProvider = StateProvider<Map<String, dynamic>?>((ref) => null);

// Data Sources
final authDataSourceProvider = Provider<AuthDataSource>((ref) {
  return AuthDataSource(
    ref.read(firebaseAuthProvider),
    ref.read(apiDataSourceProvider),
  );
});

final firestoreDataSourceProvider = Provider<FirestoreDataSource>((ref) {
  return FirestoreDataSource(ref.read(firestoreProvider));
});

final apiDataSourceProvider = Provider<ApiDataSource>((ref) {
  return ApiDataSource(ref.read(dioProvider));
});

// Repositories
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.read(authDataSourceProvider),
    ref.read(firestoreDataSourceProvider),
  );
});

final busRepositoryProvider = Provider<BusRepository>((ref) {
  return BusRepository(ref.read(firestoreDataSourceProvider));
});

final tripRepositoryProvider = Provider<TripRepository>((ref) {
  return TripRepository(ref.read(firestoreDataSourceProvider));
});

final trackingRepositoryProvider = Provider<TrackingRepository>((ref) {
  return TrackingRepository(
    ref.read(apiDataSourceProvider),
    ref.read(firestoreDataSourceProvider),
  );
});

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository(
    ref.read(authDataSourceProvider),
    ref.read(firestoreDataSourceProvider),
  );
});

final userProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final authState = ref.watch(authStateProvider);
  final user = authState.value;
  if (user == null) return null;

  final collegeId = ref.watch(selectedCollegeIdProvider);
  if (collegeId == null) return null;

  return ref.read(userRepositoryProvider).getCurrentUserProfile(collegeId);
});

final busesProvider = StreamProvider.family<List<Bus>, String>((ref, collegeId) {
  return ref.watch(busRepositoryProvider).getBuses(collegeId);
});
