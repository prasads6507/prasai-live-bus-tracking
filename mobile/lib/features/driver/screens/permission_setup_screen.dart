import 'dart:io';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class PermissionSetupScreen extends StatefulWidget {
  const PermissionSetupScreen({super.key});

  @override
  State<PermissionSetupScreen> createState() => _PermissionSetupScreenState();
}

class _PermissionSetupScreenState extends State<PermissionSetupScreen> with WidgetsBindingObserver {
  bool _alwaysLocationGranted = false;
  bool _notificationGranted = false;
  bool _batteryOptimizationIgnored = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkPermissions();
    }
  }

  Future<void> _checkPermissions() async {
    final alwaysLocationStatus = await Permission.locationAlways.status;
    final notificationStatus = await Permission.notification.status;
    final batteryStatus = await Permission.ignoreBatteryOptimizations.status;

    if (mounted) {
      setState(() {
        _alwaysLocationGranted = alwaysLocationStatus.isGranted;
        _notificationGranted = notificationStatus.isGranted;
        _batteryOptimizationIgnored = batteryStatus.isGranted;
      });
    }
  }

  Future<void> _requestAlwaysLocation() async {
    // First request "When in use"
    var status = await Permission.location.request();
    if (status.isGranted) {
      // Then request "Always"
      status = await Permission.locationAlways.request();
    }
    
    if (status.isPermanentlyDenied) {
      openAppSettings();
    }
    _checkPermissions();
  }

  Future<void> _requestNotification() async {
    await Permission.notification.request();
    _checkPermissions();
  }

  Future<void> _requestIgnoreBattery() async {
    await Permission.ignoreBatteryOptimizations.request();
    _checkPermissions();
  }

  @override
  Widget build(BuildContext context) {
    final allDone = _alwaysLocationGranted && _notificationGranted && (Platform.isIOS || _batteryOptimizationIgnored);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text("Tracking Setup"),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppColors.textPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Background Tracking",
              style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text(
              "To ensure students see your live location even when your screen is off, please complete these steps.",
              style: AppTypography.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 32),
            _buildPermissionItem(
              icon: Icons.location_on,
              title: "Location: Always Allow",
              description: "Select 'Allow all the time' in settings so tracking doesn't pause when you exit the app.",
              isGranted: _alwaysLocationGranted,
              onTap: _requestAlwaysLocation,
            ),
            const SizedBox(height: 24),
            _buildPermissionItem(
              icon: Icons.notifications,
              title: "Notifications",
              description: "Required to show the persistent 'Trip Active' status in your notification bar.",
              isGranted: _notificationGranted,
              onTap: _requestNotification,
            ),
            if (Platform.isAndroid) ...[
              const SizedBox(height: 24),
              _buildPermissionItem(
                icon: Icons.battery_saver,
                title: "Ignore Battery Optimization",
                description: "Prevents the system from killing the tracking service to save power.",
                isGranted: _batteryOptimizationIgnored,
                onTap: _requestIgnoreBattery,
              ),
              const SizedBox(height: 32),
              _buildOEMTips(),
            ],
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: allDone ? () => Navigator.pop(context) : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  disabledBackgroundColor: AppColors.divider,
                ),
                child: Text(
                  allDone ? "Everything Ready!" : "Please Complete All Steps",
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPermissionItem({
    required IconData icon,
    required String title,
    required String description,
    required bool isGranted,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: isGranted ? null : onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isGranted ? AppColors.primary.withOpacity(0.05) : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isGranted ? AppColors.primary.withOpacity(0.3) : AppColors.divider.withOpacity(0.5),
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isGranted ? AppColors.primary : AppColors.textTertiary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isGranted ? Icons.check : icon,
                color: isGranted ? Colors.white : AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: isGranted ? AppColors.primary : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: AppTypography.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            if (!isGranted)
              const Icon(Icons.arrow_forward_ios, size: 16, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  Widget _buildOEMTips() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.amber.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.amber.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.info_outline, color: Colors.amber, size: 20),
              SizedBox(width: 10),
              Text("Device Specific Tips", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            "• Samsung: Battery > Background usage limits > Never auto-sleeping apps > Add this app.\n"
            "• Xiaomi: App Info > Battery saver > No restrictions.\n"
            "• OnePlus: App Info > Battery > Don't optimize.",
            style: AppTypography.textTheme.bodySmall?.copyWith(color: Colors.amber.shade900, height: 1.5),
          ),
        ],
      ),
    );
  }
}
