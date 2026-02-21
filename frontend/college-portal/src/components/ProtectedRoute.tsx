import { type ReactNode } from 'react';
import { useParams, Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!user || !token) {
        // Clear potential partial data
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return <Navigate to={`/${orgSlug}/login`} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
