import 'dart:async';
import 'dart:isolate';
import 'dart:ui';
import 'package:background_locator_2/background_locator.dart';
import 'package:background_locator_2/location_dto.dart';
import 'package:background_locator_2/settings/android_settings.dart';
import 'package:background_locator_2/settings/ios_settings.dart';
import 'package:background_locator_2/settings/locator_settings.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../../data/models/location_point.dart';
import '../../../core/config/env.dart';

class LocationCallbackHandler {
  static const String isolateName = "LocatorIsolate";
  static String? _collegeId;
  static String? _busId;

  @pragma('vm:entry-point')
  static Future<void> initCallback(Map<dynamic, dynamic> params) async {
    _collegeId = params['collegeId'];
    _busId = params['busId'];
    await Firebase.initializeApp();
    
    final SendPort? sendPort = IsolateNameServer.lookupPortByName(isolateName);
    sendPort?.send(null);
  }

  @pragma('vm:entry-point')
  static Future<void> disposeCallback() async {
    final SendPort? sendPort = IsolateNameServer.lookupPortByName(isolateName);
    sendPort?.send(null);
  }

  @pragma('vm:entry-point')
  static Future<void> callback(LocationDto locationDto) async {
    final SendPort? sendPort = IsolateNameServer.lookupPortByName(isolateName);
    sendPort?.send(locationDto);

    if (_collegeId != null && _busId != null) {
      try {
        // Authenticate request using Firebase Auth Token
        final user = FirebaseAuth.instance.currentUser;
        if (user == null) return;
        
        final token = await user.getIdToken();
        if (token == null) return;

        final speedMph = locationDto.speed * 2.23694;

        final dio = Dio();
        dio.options.headers['Authorization'] = 'Bearer $token';

        // NOTE: The backend expects flat payload: latitude, longitude, speed, heading
        await dio.post(
          '${Env.apiUrl}/api/driver/tracking/$_busId',
          data: {
            'collegeId': _collegeId,
            'latitude': locationDto.latitude,
            'longitude': locationDto.longitude,
            'speed': speedMph,
            'heading': locationDto.heading,
          },
        );
      } catch (e) {
        // Silent fail in background allowed to keep isolate running on network drops
      }
    }
  }

  @pragma('vm:entry-point')
  static Future<void> notificationCallback() async {}
}

class DriverLocationService {
  static const String _isolateName = LocationCallbackHandler.isolateName;
  static ReceivePort? _port;

  static Future<void> initialize() async {
    await BackgroundLocator.initialize();
  }

  static Future<void> startTracking(String collegeId, String busId, Function(LocationDto) onLocationUpdate) async {
    if (await BackgroundLocator.isServiceRunning()) {
      await BackgroundLocator.unRegisterLocationUpdate();
    }

    _port?.close();
    _port = ReceivePort();
    IsolateNameServer.registerPortWithName(_port!.sendPort, _isolateName);

    _port!.listen((dynamic data) {
      if (data != null && data is LocationDto) {
        onLocationUpdate(data);
      }
    });

    final data = {'collegeId': collegeId, 'busId': busId};

    await BackgroundLocator.registerLocationUpdate(
      LocationCallbackHandler.callback,
      initCallback: LocationCallbackHandler.initCallback,
      initDataCallback: data,
      disposeCallback: LocationCallbackHandler.disposeCallback,
      iosSettings: const IOSSettings(
        accuracy: LocationAccuracy.NAVIGATION,
        distanceFilter: 5,
        showsBackgroundLocationIndicator: true,
      ),
      androidSettings: const AndroidSettings(
        accuracy: LocationAccuracy.NAVIGATION,
        interval: 5,
        distanceFilter: 5,
        client: LocationClient.google,
        androidNotificationSettings: AndroidNotificationSettings(
          notificationChannelName: 'Location Tracking',
          notificationTitle: 'Trip Active',
          notificationMsg: 'Tracking your precise location',
          notificationBigMsg: 'Background tracking running',
          notificationIconColor: Colors.blue,
          notificationTapCallback: LocationCallbackHandler.notificationCallback,
        ),
      ),
    );
  }

  static Future<void> stopTracking() async {
    IsolateNameServer.removePortNameMapping(_isolateName);
    _port?.close();
    _port = null;
    await BackgroundLocator.unRegisterLocationUpdate();
  }
}
