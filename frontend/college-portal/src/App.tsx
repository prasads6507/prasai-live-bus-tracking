import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import FindOrganization from './pages/FindOrganization';

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

        {/* Protected Routes placeholder */}
        <Route path="/:orgSlug/*" element={<Navigate to={`login`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
