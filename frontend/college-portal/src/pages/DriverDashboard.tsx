import { useNavigate, useParams } from 'react-router-dom';

const DriverDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate(`/${orgSlug}/driver`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold mb-4">Driver Dashboard</h1>
            <p className="text-slate-600 mb-8">Welcome, Driver! Trip management features coming soon.</p>
            <button
                onClick={handleLogout}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
                Logout
            </button>
        </div>
    );
};

export default DriverDashboard;
