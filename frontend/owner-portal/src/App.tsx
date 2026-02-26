import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Colleges from './pages/Colleges';
import CollegeAdmins from './pages/CollegeAdmins';
import Analytics from './pages/Analytics';
import FirebaseUsage from './pages/FirebaseUsage';
import Register from './pages/Register';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/colleges" element={<Colleges />} />
              <Route path="/college-admins" element={<CollegeAdmins />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/firebase-usage" element={<FirebaseUsage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
