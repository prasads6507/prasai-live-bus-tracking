# Project: Bannu Bus Application

## Vision
A comprehensive live bus tracking and student attendance system for colleges. It ensures student safety through real-time notifications for parents and efficient trip management for drivers and admins.

## Tech Stack
- **Mobile**: Flutter (Riverpod, GoRouter, MapLibre, Firebase SDK)
- **Backend**: Node.js, Express, Firebase Admin SDK
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Database/Auth**: Firebase Firestore & Firebase Auth
- **Infrastructure**: Vercel (Backend/Frontend), Android release APKs

## Non-Negotiable Constraints
- **Instant Notifications**: Parents must be notified immediately upon student boarding/drop-off.
- **Battery Efficiency**: Mobile tracking must be optimized for long driver shifts.
- **Multi-Tenant Isolation**: Data must be strictly scoped to the `collegeId`.
