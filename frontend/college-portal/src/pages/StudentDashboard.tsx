import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bus, LogOut, User } from 'lucide-react';
import { validateSlug } from '../services/api';

const StudentDashboard = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [college, setCollege] = useState<any>(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate(`/${orgSlug}/student/login`);
            return;
        }

        const loadCollege = async () => {
            try {
                const data = await validateSlug(orgSlug || '');
                setCollege(data);
            } catch (err) {
                console.error(err);
            }
        };
        loadCollege();
    }, [orgSlug, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('current_college_id');
        navigate(`/${orgSlug}/student/login`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Bus size={24} />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">Student Portal</h1>
                            <p className="text-sm text-slate-400">{college?.collegeName}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-2xl font-bold">
                            {user?.name?.charAt(0) || <User size={32} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Welcome, {user?.name || 'Student'}!</h2>
                            <p className="text-slate-400">{user?.email}</p>
                        </div>
                    </div>

                    <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <h3 className="font-semibold text-blue-400 mb-2">🚍 Bus Tracking Coming Soon!</h3>
                        <p className="text-slate-300 text-sm">
                            You will be able to track your college buses in real-time right here. Stay tuned for updates!
                        </p>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default StudentDashboard;
