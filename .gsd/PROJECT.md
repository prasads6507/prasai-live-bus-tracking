# Project: Notification System Fix & Firebase Sync

## Vision
Stabilize the skip-stop notification system and ensure synchronization between the mobile app's logic and Firebase/Backend triggers. This project aims to fix regressions introduced after version `8efad53` and perform a clean "force update" to Firebase.

## Tech Stack
- **Mobile**: Flutter (Riverpod, Firebase SDK)
- **Backend**: Firebase Cloud Functions (Node.js) / Vercel API
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth (ID Token based)

## Non-Negotiable Constraints
- **Reliable Token Management**: Use `getIdToken()` for all backend requests to avoid 401s in background.
- **Atomic Operations**: Use Firestore batches for stop events and progress updates.
- **Database Truth**: The `trips` collection must remain the source of truth for skip/arrival status.
