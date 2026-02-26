import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart' as geo;
import 'package:go_router/go_router.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/driver_location_service.dart';
import '../services/background_tracking_service.dart';
import '../services/trip_finalizer.dart';
import '../../../core/services/tracking_lifecycle_manager.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../data/providers.dart';
import '../../../data/models/bus.dart';
import '../../../data/models/location_point.dart';
import '../../../data/models/route.dart';
import '../../../data/models/user_profile.dart';
import '../widgets/driver_header.dart';
import '../widgets/assigned_bus_card.dart';
import '../widgets/trip_control_panel.dart';
import '../widgets/telemetry_card.dart';
import '../../../data/datasources/api_ds.dart';
import 'package:dio/dio.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/config/env.dart';
import '../../auth/controllers/auth_controller.dart';

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  String? _selectedBusId;
  String? _selectedRouteId;
  String? _selectedDirection;
  String _searchQuery = "";
  bool _isMaintenanceFlow = false;
  Bus? _maintenanceBus;
  String? _originalBusId;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Check for any pending trip finalizations on launch
    TripFinalizer.checkAndRetry();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final collegeId = ref.watch(selectedCollegeIdProvider);

    return AppScaffold(
      body: profileAsync.when(
        data: (profile) {
          if (profile == null || collegeId == null) {
            return const Center(child: Text("Profile not found"));
          }

          Widget content;
            if (_selectedBusId == null) {
            content = _buildBusSelection(collegeId, profile);
          } else if (_isMaintenanceFlow && _selectedRouteId == null) {
            content = _buildMaintenanceRouteSelection(collegeId, profile);
          } else if (_selectedRouteId == null) {
            content = _buildRouteSelection(collegeId);
          } else if (_selectedDirection == null) {
            content = _buildDirectionSelection();
          } else {
            content = _DriverContent(
              collegeId: collegeId,
              busId: _selectedBusId!,
              routeId: _selectedRouteId!,
              driverId: profile.id,
              direction: _selectedDirection!,
              isMaintenance: _isMaintenanceFlow,
              originalBusId: _originalBusId,
              onBack: () => setState(() {
                _selectedBusId = null;
                _selectedRouteId = null;
                _selectedDirection = null;
                _isMaintenanceFlow = false;
                _maintenanceBus = null;
                _originalBusId = null;
              }),
              onChangeRoute: () => setState(() {
                _selectedRouteId = null;
                _selectedDirection = null;
              }),
            );
          }

          return Column(
            children: [
              DriverHeader(
                driverName: profile.name ?? "Driver",
                isOnline: _selectedBusId != null,
                onLogout: () {
                  ref.read(authControllerProvider.notifier).signOut();
                },
              ),
              // Trip Finalization Status Banner
              ValueListenableBuilder<bool>(
                valueListenable: TripFinalizer.isFinalizing,
                builder: (context, isFinalizing, child) {
                  return ValueListenableBuilder<String?>(
                    valueListenable: TripFinalizer.error,
                    builder: (context, error, child) {
                      if (!isFinalizing && error == null) return const SizedBox.shrink();
                      
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        color: error != null ? AppColors.error.withOpacity(0.1) : AppColors.primary.withOpacity(0.1),
                        child: Row(
                          children: [
                            if (isFinalizing)
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                              )
                            else if (error != null)
                              const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                error != null 
                                  ? "Finalization failed. Tap to retry." 
                                  : "Finalizing your last trip...",
                                style: AppTypography.textTheme.bodyMedium?.copyWith(
                                  color: error != null ? AppColors.error : AppColors.primary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            if (error != null)
                              TextButton(
                                onPressed: () => TripFinalizer.checkAndRetry(),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text("RETRY"),
                              ),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
              Expanded(child: content),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text("Error: $err")),
      ),
    );
  }

  Widget _buildBusSelection(String collegeId, UserProfile profile) {
    final driverId = profile.id;
    final assignedBusId = profile.assignedBusId;
    debugPrint("[DriverHome] Driver: ${profile.email}, AssignedBusId: $assignedBusId");

    // SCENARIO 1: Driver has an assigned bus and hasn't opted for maintenance
    if (assignedBusId != null && !_isMaintenanceFlow) {
      return StreamBuilder<Bus>(
        stream: ref.watch(firestoreDataSourceProvider).getBus(collegeId, assignedBusId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final bus = snapshot.data;
          if (bus == null) {
            // Fallback: Assigned bus not found in DB
            return _buildNoAssignmentState();
          }

          final isMaintenance = bus.status == 'MAINTENANCE';
          final isInactive = bus.status == 'INACTIVE';

          return Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "Assigned Vehicle",
                      style: AppTypography.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (!isInactive)
                      IconButton(
                        onPressed: () => _showMaintenanceConsent(context),
                        icon: const Icon(Icons.build_circle_outlined, color: AppColors.primary),
                        tooltip: "Maintenance replacement",
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  isMaintenance 
                    ? "Your assigned bus is currently in maintenance."
                    : (isInactive 
                        ? "Your assigned bus is currently inactive. Please contact admin."
                        : "Ready to start your trip with your assigned bus."),
                  style: AppTypography.textTheme.bodyMedium?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 32),
                
                // Assigned Bus Card
                _buildBusCard(bus, isMaintenance || isInactive),

                const Spacer(),

                PrimaryButton(
                  text: isMaintenance || isInactive ? "Vehicle Not Available" : "Start Trip with ${bus.busNumber}",
                  onPressed: isMaintenance || isInactive 
                    ? null 
                    : () => _handleBusSelection(bus),
                ),
              ],
            ),
          );
        },
      );
    }

    // SCENARIO 2: No assignment - show error state
    if (assignedBusId == null && !_isMaintenanceFlow) {
      return _buildNoAssignmentState();
    }

    // SCENARIO 3: Maintenance flow
    return _buildMaintenanceBusList(collegeId, driverId, assignedBusId);
  }

  void _showMaintenanceConsent(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Report Maintenance?"),
        content: const Text("Is your assigned bus having an issue today? You can request maintenance and choose a replacement bus for this trip."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel"),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _isMaintenanceFlow = true;
              });
            },
            child: const Text("Yes, Find Replacement"),
          ),
        ],
      ),
    );
  }

  Widget _buildNoAssignmentState() {
    return _buildEmptyState(
      icon: Icons.directions_bus_outlined,
      title: "No Bus Assigned",
      subtitle: "Please contact your administrator to get a bus assigned to you.",
    );
  }

  Widget _buildMaintenanceBusList(String collegeId, String driverId, String? assignedBusId) {
    final busesStream = ref.watch(firestoreDataSourceProvider).getBuses(collegeId);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextButton.icon(
                onPressed: () => setState(() {
                  _isMaintenanceFlow = false;
                  _maintenanceBus = null;
                }),
                icon: const Icon(Icons.arrow_back, size: 18),
                label: const Text("Back to Assigned Bus"),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                "Find Replacement Bus",
                style: AppTypography.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Choose an available vehicle from the list below.",
                style: AppTypography.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
              const SizedBox(height: 20),
              // Search Bar
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.divider.withOpacity(0.5)),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: const InputDecoration(
                    hintText: "Search by number or plate...",
                    prefixIcon: Icon(Icons.search, color: AppColors.textTertiary),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: StreamBuilder<List<Bus>>(
            stream: busesStream,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              
              var buses = snapshot.data ?? [];
              final queryText = _searchQuery.trim().toLowerCase();

              // 1. Filter locally
              // Filter out the driver's own assigned bus
              buses = buses.where((bus) => bus.id != assignedBusId).toList();

              if (queryText.isNotEmpty) {
                buses = buses.where((bus) => 
                  bus.busNumber.toLowerCase().contains(queryText) || 
                  bus.plateNumber.toLowerCase().contains(queryText)
                ).toList();
              }

              if (buses.isEmpty) {
                return _buildEmptyState(isSearching: queryText.isNotEmpty);
              }

              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                itemCount: buses.length,
                itemBuilder: (context, index) {
                  final bus = buses[index];
                  final isCurrentlyOnRoute = bus.status == 'ON_ROUTE' || bus.activeTripId != null;
                  final isInactive = bus.status == 'INACTIVE' || bus.status == 'MAINTENANCE';

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: _buildBusCard(
                      bus, 
                      isCurrentlyOnRoute || isInactive,
                      onTap: () {
                        setState(() {
                          _maintenanceBus = bus;
                          _selectedBusId = bus.id;
                          _originalBusId = assignedBusId;
                        });
                      },
                      statusLabel: isCurrentlyOnRoute ? "ON ROUTE" : null,
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildBusCard(Bus bus, bool isDisabled, {VoidCallback? onTap, String? statusLabel}) {
    final isMaintenance = bus.status == 'MAINTENANCE';
    final isInactive = bus.status == 'INACTIVE';
    final label = statusLabel ?? (isMaintenance ? "MAINTENANCE" : (isInactive ? "INACTIVE" : null));

    return InkWell(
      onTap: isDisabled ? (onTap == null ? null : onTap) : (onTap ?? () => _handleBusSelection(bus)),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDisabled ? AppColors.surface.withOpacity(0.5) : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: label != null
              ? AppColors.error.withOpacity(0.3) 
              : AppColors.divider.withOpacity(0.5)
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: label != null
                  ? AppColors.error.withOpacity(0.1) 
                  : AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                label != null ? Icons.build_circle_outlined : Icons.directions_bus, 
                color: label != null ? AppColors.error : AppColors.primary, 
                size: 28
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        bus.busNumber,
                        style: AppTypography.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: isDisabled ? AppColors.textSecondary : AppColors.textPrimary,
                        ),
                      ),
                      if (label != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.error.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            label,
                            style: AppTypography.textTheme.labelSmall?.copyWith(
                              color: AppColors.error,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    bus.plateNumber,
                    style: AppTypography.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            if (!isDisabled || onTap != null)
              const Icon(Icons.chevron_right, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  void _handleBusSelection(Bus bus) {
    setState(() {
      _selectedBusId = bus.id;
      if (bus.activeTripId != null || bus.status == 'ON_ROUTE') {
        _selectedRouteId = bus.assignedRouteId ?? 'unknown';
        _selectedDirection = 'active';
      } else {
        _selectedRouteId = bus.assignedRouteId;
      }
    });
  }

  Widget _buildMaintenanceRouteSelection(String collegeId, UserProfile profile) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() {
                  _selectedBusId = null;
                  _maintenanceBus = null;
                }),
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 8),
              Text(
                "Select Trip Route",
                style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Text(
            "Which route are you driving today?",
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // 1. Original Assigned Route
              if (profile.assignedBusId != null) ...[
                _buildSectionHeader("Your Assigned Route"),
                FutureBuilder<Bus>(
                  future: ref.read(firestoreDataSourceProvider).getBus(collegeId, profile.assignedBusId!).first,
                  builder: (context, busSnap) {
                    if (!busSnap.hasData || busSnap.data?.assignedRouteId == null) return const SizedBox.shrink();
                    return FutureBuilder<BusRoute?>(
                      future: ref.read(firestoreDataSourceProvider).getRoute(busSnap.data!.assignedRouteId!),
                      builder: (context, routeSnap) {
                        if (!routeSnap.hasData || routeSnap.data == null) return const SizedBox.shrink();
                        return _buildRouteCard(routeSnap.data!);
                      },
                    );
                  },
                ),
                const SizedBox(height: 24),
              ],

              // 2. Maintenance Bus Route
              if (_maintenanceBus?.assignedRouteId != null && _maintenanceBus?.assignedRouteId != profile.assignedBusId) ...[
                _buildSectionHeader("Replacement Bus's Route"),
                FutureBuilder<BusRoute?>(
                  future: ref.read(firestoreDataSourceProvider).getRoute(_maintenanceBus!.assignedRouteId!),
                  builder: (context, routeSnap) {
                    if (!routeSnap.hasData || routeSnap.data == null) return const SizedBox.shrink();
                    return _buildRouteCard(routeSnap.data!);
                  },
                ),
                const SizedBox(height: 24),
              ],
              
              const Divider(),
              const SizedBox(height: 16),
              _buildSectionHeader("Other Routes"),
              TextButton(
                onPressed: () => setState(() => _isMaintenanceFlow = false), // Switch back to normal route selection
                child: const Text("Show All College Routes"),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(
        title.toUpperCase(),
        style: AppTypography.textTheme.labelMedium?.copyWith(
          color: AppColors.textTertiary,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildRouteCard(BusRoute route) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: InkWell(
        onTap: () => setState(() => _selectedRouteId = route.id),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.divider.withOpacity(0.5)),
          ),
          child: Row(
            children: [
              const Icon(Icons.map, color: AppColors.primary),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      route.routeName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Text(
                      "${route.stops.length} stops",
                      style: TextStyle(color: AppColors.textTertiary, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRouteSelection(String collegeId) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() => _selectedBusId = null),
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 8),
              Text(
                "Select Route",
                style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Text(
            "Choose a route to start your trip",
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: FutureBuilder<List<BusRoute>>(
            future: ref.read(firestoreDataSourceProvider).getCollegeRoutes(collegeId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text("Error: ${snapshot.error}"));
              }
              
              final routes = snapshot.data ?? [];
              if (routes.isEmpty) {
                return const Center(child: Text("No routes found for this college."));
              }

              return ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: routes.length,
                itemBuilder: (context, index) {
                  final route = routes[index];
                  return _buildRouteCard(route);
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDirectionSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() => _selectedRouteId = null),
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 8),
              Text(
                "Select Direction",
                style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Text(
            "Choose pickup or drop-off for this trip",
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                InkWell(
                  onTap: () => setState(() => _selectedDirection = 'pickup'),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(color: AppColors.primary.withOpacity(0.1), blurRadius: 16, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.upload_rounded, color: Colors.white, size: 48),
                        SizedBox(width: 20),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Pickup (AM)", style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                            SizedBox(height: 4),
                            Text("Stops in normal order", style: TextStyle(color: Colors.white70, fontSize: 14)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                InkWell(
                  onTap: () => setState(() => _selectedDirection = 'dropoff'),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.accent, AppColors.accent.withOpacity(0.8)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(color: AppColors.accent.withOpacity(0.1), blurRadius: 16, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.download_rounded, color: Colors.white, size: 48),
                        SizedBox(width: 20),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Drop-off (PM)", style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                            SizedBox(height: 4),
                            Text("Stops in reverse order", style: TextStyle(color: Colors.white70, fontSize: 14)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState({
    bool isSearching = false,
    IconData? icon,
    String? title,
    String? subtitle,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon ?? (isSearching ? Icons.search_off : Icons.bus_alert_rounded), 
              size: 64, 
              color: AppColors.textTertiary.withOpacity(0.5)
            ),
            const SizedBox(height: 16),
            Text(
              title ?? (isSearching ? "No buses found" : "No buses assigned to you."),
              style: const TextStyle(color: AppColors.textTertiary, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle ?? (isSearching 
                ? "Try searching for a different bus number."
                : "Please contact your administrator to assign a bus to your profile."),
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textTertiary.withOpacity(0.7)),
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverContent extends ConsumerStatefulWidget {
  final String collegeId;
  final bool isMaintenance;
  final String? originalBusId;
  final VoidCallback onBack;
  final VoidCallback onChangeRoute;

  const _DriverContent({
    required this.collegeId,
    required this.busId,
    required this.routeId,
    required this.driverId,
    required this.direction,
    required this.onBack,
    required this.onChangeRoute,
    this.isMaintenance = false,
    this.originalBusId,
  });

  @override
  ConsumerState<_DriverContent> createState() => _DriverContentState();
}

class _DriverContentState extends ConsumerState<_DriverContent> {
  StreamSubscription<Map<String, dynamic>?>? _locationUpdateSubscription;
  Timer? _pathHistoryTimer;
  bool _isLoading = false;
  bool _isTrackingStarting = false;  // Guard: prevents concurrent _startTracking calls
  double _currentSpeed = 0.0;
  String _statusText = "READY";
  String _currentRoad = "Identifying...";
  List<LocationPoint> _liveTrackBuffer = [];
  BusRoute? _currentRoute; 
  LocationPoint? _lastRecordedPoint;
  String _lastUpdate = "--:--:--";
  
  @override
  void initState() {
    super.initState();
    _fetchRoute();
  }

  Future<void> _fetchRoute() async {
    final route = await ref.read(firestoreDataSourceProvider).getRoute(widget.routeId);
    if (mounted) {
      setState(() => _currentRoute = route);
    }
  }
  
  @override
  void dispose() {
    _locationUpdateSubscription?.cancel();
    _pathHistoryTimer?.cancel();
    super.dispose();
  }

  Future<void> _updateRoadName(double lat, double lng) async {
    try {
      List<geo.Placemark> placemarks = await geo.placemarkFromCoordinates(lat, lng);
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        final road = p.street ?? p.name ?? "Unknown Road";
        if (mounted && _currentRoad != road) {
          setState(() => _currentRoad = road);
          try {
             ref.read(firestoreDataSourceProvider).updateBusRoadName(widget.busId, road);
          } catch(e) {}
        }
      }
    } catch (e) {
      // Quiet fail
    }
  }

  Future<void> _startTracking(String tripId) async {
    // ─── GUARD: Prevent concurrent or redundant starts ──────────────────────
    if (_isTrackingStarting || _locationUpdateSubscription != null) {
      debugPrint("[DriverContent] _startTracking SKIPPED (already starting or active)");
      return;
    }
    _isTrackingStarting = true;

   try {
    // ─── STEP 1: Notification permission FIRST (Android 13+) ────────────────
    // Android 13+ requires POST_NOTIFICATIONS before starting a foreground
    // service that shows a notification. Doing this AFTER service.start() 
    // causes a SecurityException / ForegroundServiceStartNotAllowedException.
    if (Platform.isAndroid) {
      try {
        final notifStatus = await Permission.notification.status;
        if (notifStatus.isDenied) {
          final result = await Permission.notification.request();
          if (result.isPermanentlyDenied) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text("Notification permission denied. Tracking will work but no persistent notification."),
                  duration: Duration(seconds: 4),
                ),
              );
            }
            // Continue anyway – tracking will work without persistent notification
          }
        }
      } catch (e) {
        debugPrint("[DriverContent] Notification permission error (non-fatal): $e");
      }
    }

    if (!mounted) return;

    // ─── STEP 2: Fine/Coarse location WHILE-IN-USE ───────────────────────────
    // Android requires you to get while-in-use permission FIRST before
    // requesting background location – this sequence is mandatory.
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || 
          permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Location permission is required to track trips")),
          );
        }
        return;
      }
    } catch (e) {
      debugPrint("[DriverContent] Location permission error: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Location permission error: $e")),
        );
      }
      return;
    }

    if (!mounted) return;

    // ─── STEP 3: Background location (only after fine/coarse granted) ─────────
    if (Platform.isAndroid) {
      try {
        final bgStatus = await Permission.locationAlways.status;
        if (bgStatus.isDenied) {
          // This is shown as a separate system dialog on Android
          await Permission.locationAlways.request();
        }
      } catch (e) {
        debugPrint("[DriverContent] Background location permission error (non-fatal): $e");
      }
    }

    if (!mounted) return;

    // ─── STEP 4: Battery optimization (optional, non-blocking) ───────────────
    try {
      if (Platform.isAndroid) {
        final battStatus = await Permission.ignoreBatteryOptimizations.status;
        if (battStatus.isDenied) {
          await Permission.ignoreBatteryOptimizations.request();
        }
      }
    } catch (e) {
      debugPrint("[DriverContent] Battery optimization error (non-fatal): $e");
    }

    if (!mounted) return;

    // ─── STEP 5: Save tracking context keys BEFORE starting background service ─
    // The background isolate starts and immediately reads these keys.
    // If they're missing, it calls stopSelf() causing the app to "crash".
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('track_college_id', widget.collegeId);
      await prefs.setString('track_bus_id', widget.busId);
      await prefs.setString('track_trip_id', tripId);
      await prefs.setString('api_base_url', Env.apiUrl);
      debugPrint("[DriverContent] Tracking keys saved: college=${widget.collegeId}, bus=${widget.busId}, trip=$tripId");
    } catch (e) {
      debugPrint("[DriverContent] Failed to save tracking keys (CRITICAL): $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to initialize tracking storage: $e")),
        );
      }
      return;
    }

    if (!mounted) return;

    // ─── STEP 6: Start the background foreground service ─────────────────────
    try {
      await BackgroundTrackingService.start();
      debugPrint("[DriverContent] Background service started successfully");
    } catch (e) {
      debugPrint("[DriverContent] Failed to start background service: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Could not start background tracking: $e")),
        );
      }
      return;
    }

    if (!mounted) return;

    // ─── STEP 7: Subscribe to location updates from background isolate ────────
    try {
      _locationUpdateSubscription?.cancel();
      final service = FlutterBackgroundService();
      _locationUpdateSubscription = service.on('update').listen((data) {
        debugPrint("[DriverContent] RECEIVED update from background: $data");
        if (data != null && mounted) {
          try {
            setState(() {
              _currentSpeed = (data['speed'] as num? ?? 0.0).toDouble();
              _lastUpdate = TimeOfDay.now().format(context);
              _statusText = data['status'] as String? ?? "ON_ROUTE";
              _lastRecordedPoint = LocationPoint(
                latitude:  (data['lat'] as num).toDouble(),
                longitude: (data['lng'] as num).toDouble(),
                timestamp: DateTime.now(),
                speed:   (data['speed'] as num?)?.toDouble(),
                heading: (data['heading'] as num?)?.toDouble(),
              );
            });
            _updateRoadName((data['lat'] as num).toDouble(), (data['lng'] as num).toDouble());
          } catch (e) {
            debugPrint("[DriverContent] State update error (non-fatal): $e");
          }
        }
      });
    } catch (e) {
      debugPrint("[DriverContent] Failed to subscribe to service updates: $e");
    }
   } catch (e) {
    debugPrint("[DriverContent] _startTracking unexpected error: $e");
   } finally {
    _isTrackingStarting = false;
   }
  } // end _startTracking

  void _stopTracking() async {
    await TrackingLifecycleManager.stopTrackingAndClearContext();
    
    if (mounted) {
      setState(() {
        _locationUpdateSubscription?.cancel();
        _locationUpdateSubscription = null;
        _pathHistoryTimer?.cancel();
        _pathHistoryTimer = null;
        _isTrackingStarting = false;
        _currentSpeed = 0.0;
        _currentRoad = "Ready";
        _lastRecordedPoint = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final busStream = ref.watch(firestoreDataSourceProvider).getBus(widget.collegeId, widget.busId);
    
    return StreamBuilder<Bus>(
      stream: busStream,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final bus = snapshot.data!;
        final isTripActive = bus.status == 'ON_ROUTE' || 
                             bus.activeTripId != null;

        final routeName = _currentRoute?.routeName ?? "Loading Route...";

        // Auto-resume logic - only if bus truly has an active trip
        final resumeTripId = bus.activeTripId;
        if (isTripActive && resumeTripId != null && resumeTripId.isNotEmpty &&
            _locationUpdateSubscription == null && !_isLoading && !_isTrackingStarting) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _startTracking(resumeTripId));
        }

        // Auto-stop logic if ended externally
        if (!isTripActive && _locationUpdateSubscription != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) async {
            if (_locationUpdateSubscription != null) {
               debugPrint("Ending trip externally initiated (Admin/System)");
               final prefs = await SharedPreferences.getInstance();
               final lastTripId = prefs.getString('track_trip_id');
               
               if (lastTripId != null) {
                 debugPrint("[DriverContent] Sending buffered history for externally ended trip $lastTripId");
                 await TripFinalizer.finalizeTrip(
                   collegeId: widget.collegeId,
                   busId: widget.busId,
                   tripId: lastTripId,
                 );
               }

               _stopTracking();
               if (mounted) {
                 ScaffoldMessenger.of(context).showSnackBar(
                   const SnackBar(
                     content: Text("Trip ended externally (e.g. by Administrator)."),
                     backgroundColor: Colors.orange,
                   ),
                 );
                 widget.onBack();
               }
            }
          });
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            children: [
              Row(
                children: [
                   IconButton(
                    onPressed: widget.onBack,
                    icon: Icon(Icons.arrow_back, color: AppColors.textPrimary),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "Trip Dashboard",
                    style: AppTypography.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              DriverStatusCard(
                speed: _currentSpeed.roundToDouble(),
                isTracking: isTripActive,
                statusText: isTripActive ? "ON TRIP" : "READY",
                currentRoad: _currentRoad,
                lastUpdateTime: _lastUpdate,
              ),
              const SizedBox(height: 24),
              AssignedBusCard(
                busNumber: bus.busNumber,
                licensePlate: bus.plateNumber,
                routeName: routeName,
              ),
              if (!isTripActive) ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: widget.onChangeRoute,
                  icon: const Icon(Icons.edit, size: 16),
                  label: const Text("Change Route"),
                ),
              ],
              const SizedBox(height: 32),
              
              // ─── OWNERSHIP & CONTROL PANEL ────────────────────────────────
              _buildControlPanel(bus, isTripActive, routeName),

              const SizedBox(height: 40),
              Text(
                "Keep this screen open while driving to ensure location updates are sent.",
                textAlign: TextAlign.center,
                style: AppTypography.textTheme.labelSmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildControlPanel(Bus bus, bool isTripActive, String routeName) {
    final tripStartedByAnotherDriver = isTripActive && 
                                       bus.currentDriverId != null && 
                                       bus.currentDriverId != widget.driverId;

    if (tripStartedByAnotherDriver) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.error.withOpacity(0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.error.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            const Icon(Icons.lock_person_rounded, color: AppColors.error, size: 40),
            const SizedBox(height: 16),
            Text(
              "Trip In Progress",
              style: AppTypography.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "This vehicle is currently being driven by another driver. You cannot start or end trips for this bus right now.",
              textAlign: TextAlign.center,
              style: AppTypography.textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            PrimaryButton(
              text: "Return Home",
              onPressed: widget.onBack,
              backgroundColor: AppColors.error,
            ),
          ],
        ),
      );
    }

    return TripControlPanel(
      isTripActive: isTripActive,
      isLoading: _isLoading,
      onStartTrip: () async {
        setState(() => _isLoading = true);
        try {
          final profile = ref.read(userProfileProvider).asData?.value;
          final tripId = await ref.read(trackingRepositoryProvider).startTrip(
            collegeId: widget.collegeId,
            busId: widget.busId,
            driverId: widget.driverId,
            routeId: widget.routeId,
            busNumber: bus.busNumber,
            driverName: profile?.name,
            direction: widget.direction,
            isMaintenance: widget.isMaintenance,
            originalBusId: widget.originalBusId,
          );
          if (mounted) _startTracking(tripId);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text("Trip started successfully!")),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text("Error starting trip: $e")),
            );
          }
        } finally {
          if (mounted) setState(() => _isLoading = false);
        }
      },
      onEndTrip: () async {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text("End Trip?"),
            content: const Text("Are you sure you want to end this trip and stop tracking?"),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("CANCEL")),
              TextButton(onPressed: () => Navigator.pop(context, true), child: const Text("END TRIP")),
            ],
          ),
        );

        if (confirmed != true) return;

        try {
          final String? activeTripId = bus.activeTripId;

          // 1. Stop location stream immediately (local UI & Background service)
          _stopTracking();

          if (activeTripId != null && activeTripId.isNotEmpty) {
            // 2. Start background finalization (unawaited)
            unawaited(TripFinalizer.finalizeTrip(
              collegeId: widget.collegeId,
              busId: widget.busId,
              tripId: activeTripId,
            ));
          }
          
          _liveTrackBuffer.clear();

          // 3. Navigate home immediately
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text("Trip ending... Returning home."),
                duration: Duration(seconds: 2),
              ),
            );
            widget.onBack();
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text("Error ending trip: $e")),
            );
          }
        }
      },
    );
  }
}
