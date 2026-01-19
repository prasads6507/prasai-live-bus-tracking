import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bus, Search, MapPin, Shield, ArrowRight, ChevronRight } from 'lucide-react';

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden font-sans">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-10 p-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center gap-2 font-bold text-2xl"
                    >
                        <div className="bg-blue-600 p-2 rounded-xl">
                            <Bus size={24} className="text-white" />
                        </div>
                        <span>Prasai<span className="text-blue-400">Track</span></span>
                    </motion.div>

                    <motion.button
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/find-organization')}
                        className="px-6 py-3 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl font-semibold border border-white/20 transition-all"
                    >
                        Admin Login
                    </motion.button>
                </div>
            </header>

            {/* Hero Section */}
            <main className="relative flex items-center justify-center min-h-screen px-6">
                {/* Background Shapes */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]"></div>
                </div>

                <div className="relative z-10 max-w-5xl mx-auto text-center">
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-6xl md:text-7xl font-extrabold mb-6 tracking-tight">
                            Real-Time Campus
                            <br />
                            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Bus Tracking
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto font-light">
                            Track your campus buses in real-time. Know exactly when your ride arrives.
                            Built for students, managed by admins.
                        </p>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/find-organization')}
                            className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-2xl font-bold text-lg shadow-2xl shadow-blue-500/30 transition-all"
                        >
                            <Search size={24} />
                            <span>Find Your Organization</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                    </motion.div>

                    {/* Feature Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
                        <FeatureCard
                            icon={<MapPin size={32} />}
                            title="Live Tracking"
                            description="See your bus location in real-time on the map"
                        />
                        <FeatureCard
                            icon={<Shield size={32} />}
                            title="Secure & Private"
                            description="Your data is encrypted and protected"
                        />
                        <FeatureCard
                            icon={<Bus size={32} />}
                            title="Multi-Campus"
                            description="Supports multiple organizations seamlessly"
                        />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 p-6 text-center text-slate-400 text-sm">
                <p>© 2026 PrasaiTrack. Powering smart campus transportation.</p>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: any) => (
    <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
    >
        <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
    </motion.div>
);

export default Home;
