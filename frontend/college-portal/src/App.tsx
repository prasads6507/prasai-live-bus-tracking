import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import FindOrganization from './pages/FindOrganization';
import DriverLogin from './pages/DriverLogin';
import DriverDashboard from './pages/DriverDashboard';
import Drivers from './pages/Drivers';
import Buses from './pages/Buses';

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
        <Route path="/:orgSlug/login" element={<Login />} />
        <Route path="/:orgSlug/dashboard" element={<Dashboard />} />

        {/* Driver Portal */}
        <Route path="/:orgSlug/driver" element={<DriverLogin />} />
        <Route path="/:orgSlug/driver-dashboard" element={<DriverDashboard />} />

        {/* Admin Features */}
        <Route path="/:orgSlug/drivers" element={<Drivers />} />
        <Route path="/:orgSlug/buses" element={<Buses />} />

        {/* Protected Routes placeholder */}
        <Route path="/:orgSlug/*" element={<Navigate to={`login`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
