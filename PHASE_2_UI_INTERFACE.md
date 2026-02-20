# Phase 2 — UI Interface (Dark Theme, Student + Driver Screens)

> Goal: Implement the **exact UI direction** shown in your screenshots, using a dark modern layout, primary color `#3702c8`, and a clean, minimal, “premium” look.

This Phase 2 document defines:
- UI layout and components (Student & Driver)
- Navigation and screen hierarchy
- Widgets to build
- Data binding for each widget (which Firestore/API fields)
- Accessibility + performance
- UI acceptance criteria

---

## 1) Design system

### 1.1 Colors
- Primary: `#3702c8`
- Background: near-black (e.g., `#0B0B10`)
- Surface cards: `#141421` or `#17172A`
- Text primary: `#FFFFFF`
- Text secondary: `#B9B9C7`
- Success: `#2BD576`
- Warning: `#FFB020`
- Danger: `#FF3B30`

### 1.2 Typography
Use Material 3 typography with custom weights:
- Title: 18–22, semibold
- Body: 14–16
- Secondary labels: 12–13

### 1.3 Spacing / shape
- Cards: 16px padding
- Corners: 18–22 radius
- Shadows: subtle (avoid heavy)

### 1.4 Global UI components library
Use built-in Material 3 components + custom widgets.
Avoid heavy UI kits unless needed.

---

## 2) App navigation structure

### 2.1 Shell-based navigation
After login, show one of:

- `StudentShell` (bottom nav)
- `DriverShell` (bottom nav)
- `AdminShell` (later)

### 2.2 Student bottom nav tabs (matches dark screenshot)
- Home
- Track
- Search (replacing CCTV)
- Profile

### 2.3 Driver bottom nav tabs
- Home / Trip
- Profile

---

## 3) Student UI — Screen-by-screen

## 3.1 Student Home Screen (dark reference UI)

### 3.1.1 Top header
- Left: “Morning, {StudentName}”
- Right: profile avatar + search icon (optional)
- Small status indicator: green dot + “Bus Active” / “Off Route”

Data:
- student name from user profile
- live status derived from bus doc:
  - `activeTripId`, `status`, `lastLocationUpdate` freshness

### 3.1.2 Row of action cards (like screenshot tiles)
Two tiles:
1) **Track School Bus** (map preview)
2) **Search Buses** (replaces CCTV)

Tile design:
- dark surface card
- icon in circle
- small subtitle text
- tap action routes

### 3.1.3 Mini-map preview card (Track School Bus)
This is the “small map window” you described.

It must show:
- small map preview (centered on bus if live, else on route center)
- bus marker
- optional dotted route line (optional)
- bottom strip:
  - “License plate”
  - “Bus No.”
  - current street/road name
  - driver speed

When tapping map preview:
- navigate to `StudentTrackDetailScreen` (full map)

Data binding:
- bus location from Firestore bus doc:
  - `location`, `liveTrackBuffer`, `lastLocationUpdate`
- speed and heading if available
- reverse-geocode result string (cached)

### 3.1.4 Route progress panel (timeline list)
Below the mini-map:
- Title: “Bus Drop-off” or “Pickup route”
- Show:
  - “Total Stops: X”
  - “Remaining: Y”
- Expand/collapse arrow like screenshot

Timeline list items:
- Stop name
- Stop address
- status icon:
  - pending (grey)
  - current (primary)
  - completed (green)

Data:
- route stops from:
  - `routes/{routeId}.stops`
  - OR `buses/{busId}.stops`
- stop completion status from:
  - `trips/{tripId}/stopStatus/{stopId}` (future)
  - or computed proximity to stops

### 3.1.5 Student Home acceptance criteria
- UI visually matches dark screenshots
- Tapping Track card opens full map
- Street name + speed are visible in mini-map card
- Route stop list renders correctly

---

## 3.2 Student Track Detail Screen (full map)
This screen matches your “enlarged dedicated screen for realtime route update”.

Layout:
- Full map occupying top ~55–65%
- Bottom sheet with:
  - Current bus status
  - Current street/road name
  - speed
  - distance to student
  - next stop name + distance (optional)
- A small top bar with bus number and call/chat icons (optional)

Map overlays:
- bus marker with direction arrow
- student marker (optional)
- stop markers
- polyline route (optional)
- live trail dotted polyline (optional)

Behavior:
- Follow bus ON by default
- Toggle follow bus

---

## 3.3 Student Search Screen (replaces CCTV)
Purpose:
- Search buses in the organization (college)

UI:
- Search bar (bus no / plate / driver)
- Results list:
  - bus number, plate, route name
  - status chip: LIVE / IDLE
  - tap to open Track Detail with that bus context

Data:
- Firestore query:
  - `colleges/{collegeId}/buses`
  - filter in client by search text

---

## 3.4 Student History Screen (optional later)
Your orange/white screenshot shows Status | History | Bus Info tabs.
You can implement these as internal tabs within Track Detail bottom sheet:

Tabs:
- Status: route timeline + next stop
- History: trip history list
- Bus Info: plate, driver name, route name, last update time

---

## 4) Driver UI — Screen-by-screen

## 4.1 Driver Home / Trip Screen
Goal: Driver can start/end trip and see current telemetry.

Layout:
- Header with driver name + status dot
- Assigned bus card:
  - bus number, plate, route
- Primary actions:
  - Start Trip (large primary button)
  - End Trip (danger outline or red button)
- Telemetry card:
  - Current speed
  - Current road/street name
  - GPS accuracy indicator
  - Last update time

Behavior:
- When trip active:
  - Show persistent “Trip Active” banner
  - Start background service
  - Show live marker on map preview (optional)

Data:
- Assigned bus mapping from profile or bus doc
- `activeTripId` from bus doc and local storage

---

## 5) Admin UI (minimal placeholder now)
Implement basic screens but keep simple for now:
- Bus list with status chips
- Bus details with map and last location
This is lower priority per your message.

---

## 6) UI widgets list (what to build)

### Global widgets
- `AppScaffold`
- `PrimaryButton`
- `StatusChip`
- `GlassCard` (dark surface)
- `LoadingSkeleton`
- `ErrorStateView`

### Student widgets
- `BusSummaryMiniMapCard`
- `RouteTimeline`
- `StopTile`
- `BusSearchResultTile`
- `FollowBusToggle`

### Driver widgets
- `AssignedBusCard`
- `TripControlButtons`
- `DriverTelemetryCard`

---

## 7) Reverse geocoding UX (street/road name)
Where to show:
- Student mini-map card (street + speed)
- Student full map bottom sheet
- Driver telemetry

How:
- Update address not more than once every 10–15 seconds
- Cache by rounded lat/lng

---

## 8) Performance constraints
- Avoid rebuilding the full map widget every second.
- Only move marker position, not re-create map.
- Use `ValueNotifier` or state controller dedicated to marker position.

---

## 9) Phase 2 deliverables checklist
- [ ] Dark theme applied globally
- [ ] Student Home matches reference (cards + mini-map + route list)
- [ ] Student Track Detail with bottom sheet + tabs
- [ ] Student Search buses screen
- [ ] Driver Trip screen with Start/End and telemetry
- [ ] All screens responsive across iPhone/Android sizes

---

## 10) Definition of done for Phase 2
- App looks like the provided dark UI references
- Student can see bus status, street name, speed
- Driver can start/end trip from mobile UI
- All navigation flows are smooth and modern
