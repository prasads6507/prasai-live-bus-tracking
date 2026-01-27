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
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                                <Bus size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-lg tracking-tight">Student Portal</h1>
                                <p className="text-xs text-slate-400 font-medium">{college?.collegeName}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
                        >
                            <LogOut size={16} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 border border-white/10 shadow-2xl"
                >
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px]" />
                    <div className="relative z-10 p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 p-[2px] shadow-xl">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl font-bold text-blue-400">
                                {user?.name?.charAt(0) || <User size={40} />}
                            </div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-white mb-2">Hello, {user?.name?.split(' ')[0]}!</h2>
                            <div className="flex flex-wrap gap-4 text-sm text-blue-200/80">
                                <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">{user?.email}</span>
                                <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10">ID: {user?.registerNumber || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Coming Soon Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="col-span-full bg-slate-800/50 backdrop-blur-md border border-white/5 p-8 rounded-3xl relative overflow-hidden group hover:border-blue-500/30 transition-colors"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-2">
                                <Bus size={32} className="text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Live Bus Tracking</h3>
                            <p className="text-slate-400 max-w-md mx-auto">
                                Real-time location updates, estimated arrival times, and route visualization are coming soon to your dashboard.
                            </p>
                            <span className="inline-block px-4 py-1.5 bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider rounded-full">
                                In Development
                            </span>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
};

export default StudentDashboard;
