import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Lazy loading components for better performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Home = lazy(() => import('./pages/Home'));
const FindOrganization = lazy(() => import('./pages/FindOrganization'));
const DriverLogin = lazy(() => import('./pages/DriverLogin'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const Drivers = lazy(() => import('./pages/Drivers'));
const Students = lazy(() => import('./pages/Students'));
const StudentLogin = lazy(() => import('./pages/StudentLogin'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const Buses = lazy(() => import('./pages/Buses'));
const BusStudents = lazy(() => import('./pages/BusStudents'));
const RoutesPage = lazy(() => import('./pages/Routes'));
const Settings = lazy(() => import('./pages/Settings'));
const TripHistory = lazy(() => import('./pages/TripHistory'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const StudentTripHistory = lazy(() => import('./pages/StudentTripHistory'));
const CollegeAdmins = lazy(() => import('./pages/CollegeAdmins'));
const StudentAssignment = lazy(() => import('./pages/StudentAssignment'));
const BusAttendance = lazy(() => import('./pages/BusAttendance'));

import ProtectedRoute from './components/ProtectedRoute';

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-medium animate-pulse">Loading organization...</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<Home />} />

          {/* Find Organization */}
          <Route path="/find-organization" element={<FindOrganization />} />

          {/* Dynamic Organization Login */}
          <Route path="/:orgSlug/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route path="/:orgSlug/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/:orgSlug/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
          <Route path="/:orgSlug/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
          <Route path="/:orgSlug/buses" element={<ProtectedRoute><Buses /></ProtectedRoute>} />
          <Route path="/:orgSlug/buses/:busId/students" element={<ProtectedRoute><BusStudents /></ProtectedRoute>} />
          <Route path="/:orgSlug/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
          <Route path="/:orgSlug/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/:orgSlug/trip-history" element={<ProtectedRoute><TripHistory /></ProtectedRoute>} />
          <Route path="/:orgSlug/trips/:tripId" element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />
          <Route path="/:orgSlug/admins" element={<ProtectedRoute><CollegeAdmins /></ProtectedRoute>} />
          <Route path="/:orgSlug/student-assignment" element={<ProtectedRoute><StudentAssignment /></ProtectedRoute>} />
          <Route path="/:orgSlug/attendance" element={<ProtectedRoute><BusAttendance /></ProtectedRoute>} />

          {/* Driver Portal */}
          <Route path="/:orgSlug/driver" element={<DriverLogin />} />
          <Route path="/:orgSlug/driver-dashboard" element={<DriverDashboard />} />

          {/* Student Portal */}
          <Route path="/:orgSlug/student/login" element={<StudentLogin />} />
          <Route path="/:orgSlug/student/dashboard" element={<StudentDashboard />} />
          <Route path="/:orgSlug/student/trip-history" element={<StudentTripHistory />} />

          {/* Protected Routes placeholder */}
          <Route path="/:orgSlug/*" element={<Navigate to={`login`} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
