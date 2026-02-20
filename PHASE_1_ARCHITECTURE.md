# Phase 1 — Architecture (Flutter Single App: Student + Driver + Admin)

> Goal: Build **one Flutter app** that shows different experiences based on the logged-in user role (Student/Driver/Admin), while reusing the **same Firebase (Firestore + Auth) backend** and the **same live tracking logic** you already have in the web apps.

This Phase 1 document focuses on **system architecture** and **implementation plan**:
- App structure and module boundaries
- Firebase integration approach
- Tracking system data-flow (driver vs student)
- Background location constraints (Android + iOS)
- Security + tenant isolation mapping
- Logging, crash handling, analytics (optional)
- Deliverables checklist

---

## 1) Design principles

### 1.1 Single source of truth for “LIVE”
The biggest bug you observed in web is caused by **duplicated status fields** and UI deriving “live” from stale data.

In Flutter, enforce canonical “LIVE” rules:

A bus is **LIVE** only when:
1) `bus.activeTripId != null`
2) `bus.status == "ON_ROUTE"` (or derived from activeTripId)
3) `bus.lastLocationUpdate` is fresh (e.g., <= 120 seconds)

> Even if a field becomes stale, the freshness check prevents “ghost live”.

### 1.2 Keep live tracking and trip history separate
- **Live tracking**: high-frequency, short-lived, optimized for real-time map movement
- **Trip history**: low-frequency, persisted for reports/replay

This mirrors what you already designed:
- live buffer (5-point) for smooth UI
- separate path logs for trip history every 2 minutes (or as required)

### 1.3 Power/battery: students are not tracked continuously
- Student GPS: once every 3–4 minutes (or 10 minutes depending on final decision)
- Driver GPS: sampled every 1 second when trip is active, **written** to backend in 5-second batches

---

## 2) Flutter technology choices (recommended)

### 2.1 Flutter + State Management
Pick one and use consistently:

**Option A (recommended): Riverpod**
- Great for streams (`StreamProvider`) from Firestore
- Clean separation between UI and state
- Excellent testability

**Option B: Bloc**
- Also strong, but more boilerplate
- Prefer if your team already uses Bloc

### 2.2 Navigation
**go_router** (recommended)
- Declarative routing
- Guards / redirects based on auth + role

### 2.3 Maps (open-source parity with your Leaflet web app)
**flutter_map** (Leaflet-like) with OpenStreetMap tiles:
- Works well with custom markers and polylines
- Lightweight and open source

Alternative: Google Maps plugin (not “open source module”, but very stable).

### 2.4 Location + background tracking
You want:
- Driver tracking works in background until trip ends

Recommended stack:
- `geolocator` for location
- Android background: `flutter_background_service` or a ForegroundService approach
- iOS: background location mode (requires special config + user “Always” permission)

**Reality check (iOS):**
- iOS will not allow true 1-second CPU wakeups indefinitely unless using “background location updates” and the OS decides.
- You can still achieve high fidelity by using continuous location updates while backgrounded (navigation-style), but user must grant Always permission.

### 2.5 Storage
- `flutter_secure_storage` for tokens/role
- `shared_preferences` for non-sensitive UI preferences

### 2.6 Networking
You have two viable integration approaches:

**Approach A (recommended): Call your existing Express API**
- Advantages: centralizes tenant isolation, avoids Firestore rules issues, easier to secure
- Use `dio` as HTTP client
- Driver writes tracking updates via `/api/driver/tracking/:busId` and trip start/end endpoints

**Approach B: Direct Firestore reads/writes**
- Only if Firestore rules support it safely
- Still recommended to keep sensitive writes (trip start/end) via server for atomic updates

> Hybrid is best: UI reads from Firestore streams, driver writes via server endpoints.

---

## 3) Repository layout (Flutter)

Create a new repo folder `mobile/` or a separate repo.

### 3.1 Clean architecture structure (recommended)
```
lib/
  core/
    config/
      env.dart
      firebase_options.dart
    theme/
      app_theme.dart
      colors.dart
      typography.dart
    utils/
      geo.dart              # haversine, bearing, interpolation helpers
      formatters.dart
      debounce.dart
    errors/
      app_error_boundary.dart
      crash_reporter.dart

  data/
    models/
      user_profile.dart
      bus.dart
      trip.dart
      route.dart
      stop.dart
      location_point.dart
    datasources/
      auth_ds.dart          # Firebase Auth or API token login
      firestore_ds.dart     # read streams
      api_ds.dart           # calls Express API
    repositories/
      auth_repo.dart
      bus_repo.dart
      trip_repo.dart
      tracking_repo.dart
      student_repo.dart

  features/
    auth/
      screens/
        login_screen.dart
      controllers/
        auth_controller.dart
      widgets/
        org_slug_input.dart

    shell/
      role_router.dart      # redirects to StudentShell/DriverShell/AdminShell
      app_shell.dart

    student/
      screens/
        student_home.dart
        student_track.dart
        student_bus_search.dart
        student_profile.dart
      controllers/
        student_controller.dart
      widgets/
        bus_summary_card.dart
        route_timeline.dart
        small_map_preview.dart

    driver/
      screens/
        driver_home.dart
        driver_trip.dart
        driver_profile.dart
      controllers/
        driver_controller.dart
      services/
        driver_location_service.dart   # foreground/background tracking
        tracking_batcher.dart          # 1Hz sample -> 5s batch writer

    admin/
      screens/
        admin_dashboard.dart
        admin_buses.dart
      controllers/
        admin_controller.dart

main.dart
```

### 3.2 Dependency injection
Use Riverpod or get_it—avoid mixing patterns.

If Riverpod:
- Each repository is a Provider
- Each feature controller is a Provider

---

## 4) Authentication + role routing

### 4.1 Login flow
Your web app uses org slug + role-based portal. Mirror this:

1) User enters:
   - org slug (college)
   - email/phone + password
2) Authenticate:
   - Firebase Auth OR API returns JWT
3) Fetch user profile:
   - role = student / driver / admin
   - collegeId
4) Store session:
   - secure storage: token + collegeId + role
5) Route:
   - StudentShell / DriverShell / AdminShell

### 4.2 RoleRouter rules
Pseudo:
- if not logged in → LoginScreen
- else if role == student → StudentShell
- else if role == driver → DriverShell
- else if role == admin → AdminShell

### 4.3 Session persistence
On app restart:
- restore session from secure storage
- re-fetch profile if needed
- re-route accordingly

---

## 5) Firebase/Firestore integration

### 5.1 Tenant isolation (collegeId)
Every Firestore path must be scoped under:
```
colleges/{collegeId}/...
```

Do **not** rely on client-supplied collegeId for writes unless rules enforce it.
Prefer server endpoints for writes that could cross tenant boundary.

### 5.2 Canonical fields (standardize)
On bus doc:
- `status`: "IDLE" | "ON_ROUTE" | "MAINTENANCE"
- `activeTripId`: string | null
- `lastLocationUpdate`: Timestamp
- `location`: { lat, lng }
- `liveTrackBuffer`: [ {lat,lng,tMillis}, ... up to 5 ]

On trip doc:
- `status`: "active" | "ended"
- `busId`, `driverId`, `startedAt`, `endedAt`
- `endLocation`: {lat,lng,address}

Trip history path:
- `trips/{tripId}/path/{autoId}` every 2 minutes

> If your current schema differs, implement a mapping layer in `Bus.fromFirestore()`.

### 5.3 Firestore reads
Flutter will use Firestore streams for:
- Bus list
- Single bus document for live tracking
- Trip document to verify active/ended
- Stop points / route data

In Riverpod:
- `StreamProvider<List<Bus>>`
- `StreamProvider<Bus>`
- `StreamProvider<Trip>`

### 5.4 Writes (recommended via server)
Driver writes:
- tracking updates → API endpoint (server updates Firestore)
- trip start/end → API endpoint (atomic transaction)
Student writes:
- student last location → API or direct Firestore (based on rules)

---

## 6) Driver location tracking system (1Hz sample, 5s DB writes)

### 6.1 Sampling vs writing
- Sample GPS every 1 second
- Push to backend every 5 seconds with last 5 points

Why:
- UI needs 1-second motion illusion
- DB does not need 1-second writes (cost + performance)

### 6.2 TrackingBatcher service
Create `tracking_batcher.dart`:
- Holds a queue of points
- On every sample: append
- Every 5 samples:
  - build payload: points[0..4] + latest location fields
  - send to API / Firestore
  - clear queue

### 6.3 Start/stop lifecycle
When driver presses Start Trip:
1) Call `startTrip` API endpoint
2) Persist activeTripId locally
3) Start background location service
4) Begin sampling + batching

When End Trip:
1) Stop sampling service immediately
2) Call `endTrip` API endpoint
3) Clear local activeTripId and buffers

> This avoids the web bug where tracking continues after trip end and re-writes status.

---

## 7) Student tracking system (3–4 minute GPS)

### 7.1 Student sampling schedule
- On login: get one GPS reading
- Then every 3–4 minutes (timer)
- If user is stationary, can skip updates if unchanged (optional battery optimization)

### 7.2 Permissions UX
- Student: request “While using the app”
- Driver: request “Always” (explained clearly)

---

## 8) Background execution details (Android + iOS)

### 8.1 Android
- Use ForegroundService so the OS keeps service alive
- Show persistent notification:
  - “Trip active — tracking location”

### 8.2 iOS
- Enable Background Modes → Location updates
- Request Always permission
- Use continuous location updates while trip active
- Handle OS pausing/resuming updates

> Provide user messaging and settings deep link.

---

## 9) Observability and crash handling

### 9.1 Error boundary screen
If something crashes (like your student white-screen bug in web):
- Show fallback UI instead of blank screen
- Capture exception to logs

### 9.2 Logging
Add debug logging toggle:
- print tracking payloads (dev only)
- print current role routing decisions

Optional: integrate Crashlytics later.

---

## 10) Phase 1 deliverables checklist

- [ ] Flutter skeleton with clean structure
- [ ] Firebase init + env configuration
- [ ] Auth + role routing working
- [ ] Firestore models for Bus/Trip/Route/Stop
- [ ] Repositories implemented for reading bus/trip/route streams
- [ ] Driver location service created (foreground/background)
- [ ] Driver batching service created (1Hz sample -> 5s write)
- [ ] Student location timer created (3–4 min)
- [ ] Basic placeholder screens for Student/Driver shells

---

## 11) Definition of done for Phase 1
- You can log in as driver and student and land on correct shell
- Driver can start trip and the app begins tracking in foreground
- Firestore bus doc updates with liveTrackBuffer and lastLocationUpdate
- Student can subscribe to bus doc stream and see the points arriving (even before animation)
