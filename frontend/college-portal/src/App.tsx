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
import RoutesPage from './pages/Routes';
import Settings from './pages/Settings';
import TripHistory from './pages/TripHistory';
import StudentTripHistory from './pages/StudentTripHistory';
import CollegeAdmins from './pages/CollegeAdmins';

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
        <Route path="/:orgSlug/dashboard" element={<Dashboard />} />

        {/* Driver Portal */}
        <Route path="/:orgSlug/driver" element={<DriverLogin />} />
        <Route path="/:orgSlug/driver-dashboard" element={<DriverDashboard />} />

        {/* Student Portal */}
        <Route path="/:orgSlug/student/login" element={<StudentLogin />} />
        <Route path="/:orgSlug/student/dashboard" element={<StudentDashboard />} />
        <Route path="/:orgSlug/student/trip-history" element={<StudentTripHistory />} />

        {/* Admin Features */}
        <Route path="/:orgSlug/drivers" element={<Drivers />} />
        <Route path="/:orgSlug/students" element={<Students />} />
        <Route path="/:orgSlug/buses" element={<Buses />} />
        <Route path="/:orgSlug/routes" element={<RoutesPage />} />
        <Route path="/:orgSlug/settings" element={<Settings />} />
        <Route path="/:orgSlug/trip-history" element={<TripHistory />} />
        <Route path="/:orgSlug/admins" element={<CollegeAdmins />} />

        {/* Protected Routes placeholder */}
        <Route path="/:orgSlug/*" element={<Navigate to={`login`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
