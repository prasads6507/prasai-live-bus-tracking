import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to a generic login or specific org if known (for now generic) */}
        <Route path="/" element={<div className="h-screen flex items-center justify-center">Please use your Organization URL</div>} />

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
