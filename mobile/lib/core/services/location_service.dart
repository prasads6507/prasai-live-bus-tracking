import 'package:geolocator/geolocator.dart';
import 'package:flutter/material.dart';

class LocationService {
  static Future<bool> ensureLocationPermission(BuildContext context) async {
    bool serviceEnabled;
    LocationPermission permission;

    // Test if location services are enabled.
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (context.mounted) {
        await _showLocationDialog(
          context,
          'Location Services Disabled',
          'Please enable location services in your settings to continue using the app. High precision (< 5m) is required for tracking.',
          () => Geolocator.openLocationSettings(),
        );
      }
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (context.mounted) {
          await _showLocationDialog(
            context,
            'Permission Denied',
            'Location permission is mandatory for this app. Please grant permission to continue.',
            () => Geolocator.requestPermission(),
          );
        }
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      if (context.mounted) {
        await _showLocationDialog(
          context,
          'Permission Permanently Denied',
          'Location permissions are permanently denied. We cannot request permissions. Please enable them in app settings.',
          () => Geolocator.openAppSettings(),
        );
      }
      return false;
    }

    return true;
  }

  static Future<void> _showLocationDialog(
      BuildContext context, String title, String message, VoidCallback onAction) async {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              onAction();
              Navigator.pop(context);
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
