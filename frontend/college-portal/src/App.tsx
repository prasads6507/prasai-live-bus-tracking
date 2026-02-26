import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import FindOrganization from './pages/FindOrganization';
import DriverLogin from './pages/DriverLogin';
import DriverDashboard from './pages/DriverDashboard';
import Drivers from './pages/Drivers';
import Students from './pages/Students';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import Buses from './pages/Buses';
import BusStudents from './pages/BusStudents';
import RoutesPage from './pages/Routes';
import Settings from './pages/Settings';
import TripHistory from './pages/TripHistory';
import TripDetail from './pages/TripDetail';
import StudentTripHistory from './pages/StudentTripHistory';
import CollegeAdmins from './pages/CollegeAdmins';
import StudentAssignment from './pages/StudentAssignment';

import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
