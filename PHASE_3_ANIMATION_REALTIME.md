# Phase 3 — Real-time Animation (5-second buffer → 1-second movement like Uber)

> Goal: The bus marker must move smoothly **every second** on the student/admin maps even though the backend writes only every **5 seconds**. This is achieved with a **5-point buffer** in Firestore and a client-side animation engine.

This Phase 3 document defines:
- Live buffer model (A–E points)
- Stream subscription strategy (Firestore onSnapshot equivalent)
- Interpolation and animation engine
- Marker rotation (bearing/heading)
- Map camera behavior (“Follow Bus”)
- Offline/staleness handling
- Acceptance criteria and test plan

---

## 1) What you want (translated into a correct system)
You described:

- Every 5 seconds, write a batch of points to DB:
  - A, B, C, D, E (each 1 second apart)
- Student app renders:
  - second 1: point A
  - second 2: point B
  - ...
  - second 5: point E
- Then repeats continuously, without refresh

That is exactly the right mental model.
The only thing to ensure: the **driver side must sample at 1Hz** and the server must store the 5-point buffer correctly.

---

## 2) Data contract for the live buffer

### 2.1 Firestore bus doc fields (preferred)
On:
`colleges/{collegeId}/buses/{busId}`

Store:
```json
{
  "liveTrackBuffer": [
    {"lat": 12.9716, "lng": 77.5946, "tMillis": 1739978000000},
    {"lat": 12.9717, "lng": 77.5947, "tMillis": 1739978001000},
    ...
  ],
  "location": {"lat": 12.9720, "lng": 77.5950},
  "lastLocationUpdate": "serverTimestamp",
  "activeTripId": "trip_abc",
  "status": "ON_ROUTE"
}
```

Rules:
- `liveTrackBuffer` is always max length 5
- Points should be in chronological order
- `location` is the latest point (E)
- timestamps for points should be in milliseconds or ISO strings

### 2.2 Why array is OK here
A 5-element array is small and cheap to read in snapshots.
It also simplifies the student subscription: one doc stream.

---

## 3) Driver-side algorithm (producer)

### 3.1 Sampling
- Poll GPS every 1 second while trip active
- Append to local list
- When list size == 5:
  - send to server
  - clear list

### 3.2 Writing
Every 5 seconds:
- update Firestore bus doc fields:
  - `liveTrackBuffer = last 5 points`
  - `location = newest point`
  - `lastLocationUpdate = serverTimestamp`
  - optional `speed`, `heading`

### 3.3 Stopping
When trip ends:
- stop background service first
- then call endTrip endpoint
- this prevents post-end writes

---

## 4) Student-side algorithm (consumer)

### 4.1 Subscribe to bus doc stream
Student detail screen subscribes to:
`buses/{busId}` stream

On every snapshot:
- read `liveTrackBuffer`
- validate points
- push into animation engine

### 4.2 Animation engine requirements
- Update marker **every second**
- Must not rebuild the whole map widget
- Must support late buffers and catch-up

### 4.3 Core concept: a point queue
Maintain:
- `Queue<LocationPoint> animationQueue`
- `LocationPoint current`
- a 1-second timer

When a new buffer arrives:
- compare with last processed timestamp
- enqueue any points that are newer than lastTimestamp
- do not enqueue duplicates

Timer tick (every 1 second):
- if queue not empty:
  - pop next point
  - set marker position to that point
  - compute bearing from previous point and rotate marker
- else:
  - hold position (bus stopped or network delay)

---

## 5) Interpolation strategy (if points are not perfectly 1 second apart)

### 5.1 Default
If buffer contains 5 points and timestamps are close to 1 second apart:
- do not interpolate, just use the points

### 5.2 If only 2 points arrive
Sometimes due to GPS permission or platform throttling, you might get fewer points.
Then:
- interpolate intermediate positions:
  - generate 5 steps between previous and current point
  - feed them into queue

### 5.3 Linear interpolation (LERP)
Given point P0 (lat0,lng0) and P1 (lat1,lng1), for t in (0..1):
- lat = lat0 + (lat1 - lat0) * t
- lng = lng0 + (lng1 - lng0) * t

This is simple and looks good enough at city scale.

---

## 6) Marker rotation (direction arrow)

### 6.1 Prefer GPS heading if provided
If driver provides `heading`:
- rotate marker icon to heading degrees

### 6.2 Else compute bearing
Compute bearing between previous and next positions.
Store it as `markerBearing`.

> This fixes the “direction not updating” bug seen in web.

---

## 7) Map camera behavior (“Follow Bus”)

### 7.1 Follow ON by default
- Each second when marker moves:
  - if follow enabled, animate camera to marker

### 7.2 Follow OFF allows exploration
- User can pan/zoom without camera snapping back
- Provide a small floating button “Follow”

Implementation detail:
- If using `flutter_map`, control map with `MapController`
- Move camera only if follow is ON

---

## 8) Live status and staleness handling

### 8.1 Freshness check
Compute:
`now - lastLocationUpdate`

If > 120 seconds:
- show bus “offline”
- hide LIVE badge
- keep marker at last known position

### 8.2 Bus stopped but still live
If driver is stationary:
- buffer points may repeat
- movement will appear minimal (correct)
- show speed = 0 and street unchanged

---

## 9) Performance considerations

### 9.1 Avoid rebuilding the map
The map should be built once.
Only update:
- marker position
- polyline if needed

### 9.2 Use lightweight state updates
- Use `ValueNotifier<LatLng>` or Riverpod StateNotifier only for marker position
- Keep map widget stable

---

## 10) Optional enhancement: live trail polyline
You can draw a dotted polyline of the last N points:
- Keep it small (e.g., last 50)
- Append on each timer tick

This provides a nicer “moving path” feel.

---

## 11) Acceptance criteria
- Student sees bus marker move every second (no refresh)
- Movement is smooth and continuous
- Direction rotates correctly
- Map can follow bus automatically
- If bus goes offline (no updates), app shows offline state

---

## 12) Test plan (must execute)
### Driver tests
1) Start trip, background app, keep walking/driving
2) Confirm Firestore updates continue
3) End trip, confirm updates stop immediately

### Student tests
1) Open Track Detail, observe marker moving each second
2) Disable network briefly, re-enable, marker catches up
3) Confirm no refresh needed

### Edge cases
- GPS permission denied
- iOS background restrictions
- Driver kills app while trip active (server staleness should show offline)

---

## 13) Definition of done for Phase 3
- “Uber-like” movement implemented from the 5-point buffer
- No manual refresh needed
- Marker rotation and follow camera are stable
