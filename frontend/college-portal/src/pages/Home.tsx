import { useNavigate } from 'react-router-dom'; // Redeploy Sync
import { motion } from 'framer-motion';
import { Bus, Search, MapPin, ArrowRight, Users, Clock } from 'lucide-react';

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-10 p-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center gap-3 font-bold text-2xl"
                    >
                        <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
                            <Bus size={28} className="text-blue-600" />
                        </div>
                        <span className="text-slate-800 drop-shadow-sm">Prasai<span className="text-blue-600">Track</span></span>
                    </motion.div>

                    <motion.button
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/find-organization')}
                        className="px-8 py-3 bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-full font-bold shadow-sm transition-all duration-300"
                    >
                        Admin Login
                    </motion.button>
                </div>
            </header>

            {/* Hero Section */}
            <main className="relative flex items-center justify-center min-h-screen px-6">
                {/* Animated Background Orbs */}
                <div className="absolute inset-0 overflow-hidden">
                    <motion.div
                        animate={{
                            x: [0, 100, 0],
                            y: [0, -100, 0],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-200/40 rounded-full blur-[120px]"
                    />
                    <motion.div
                        animate={{
                            x: [0, -100, 0],
                            y: [0, 100, 0],
                            scale: [1, 1.3, 1]
                        }}
                        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-[120px]"
                    />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto text-center">
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="inline-block mb-6 px-6 py-3 bg-white rounded-full border border-slate-200 text-slate-600 shadow-sm text-sm font-semibold"
                        >
                            ✨ Smart Campus Transportation
                        </motion.div>

                        <h1 className="text-6xl md:text-8xl font-extrabold mb-6 tracking-tight leading-tight text-slate-900">
                            Never Miss
                            <br />
                            <span className="bg-gradient-to-r from-green-500 to-blue-600 bg-clip-text text-transparent">
                                Your Ride
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto font-medium leading-relaxed">
                            Track your campus bus in real-time. Know exactly when it arrives.
                            Built for students, powered by innovation.
                        </p>

                        <motion.button
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/find-organization')}
                            className="group inline-flex items-center gap-4 px-10 py-5 btn-premium btn-primary-gradient text-white rounded-2xl font-bold text-xl shadow-2xl transition-all duration-300"
                        >
                            <Search size={28} />
                            <span>Find Your Organization</span>
                            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                        </motion.button>
                    </motion.div>

                    {/* Feature Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
                        <FeatureCard
                            icon={<MapPin size={36} />}
                            title="Live GPS Tracking"
                            description="See your bus moving on the map in real-time"
                            delay={0.3}
                        />
                        <FeatureCard
                            icon={<Clock size={36} />}
                            title="Accurate ETAs"
                            description="Know exactly when your bus will arrive"
                            delay={0.4}
                        />
                        <FeatureCard
                            icon={<Users size={36} />}
                            title="Multi-Campus"
                            description="Supporting institutions nationwide"
                            delay={0.5}
                        />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 p-6 text-center text-slate-400 font-medium text-sm backdrop-blur-sm">
                <p>© 2026 PrasaiTrack. Making campus commutes smarter.</p>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description, delay }: any) => (
    <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay }}
        whileHover={{ y: -10, scale: 1.02, boxShadow: '0 25px 50px -12px rgba(0, 102, 255, 0.1)' }}
        className="p-8 bg-white border border-slate-100/50 rounded-[32px] transition-all group cursor-pointer shadow-lg"
    >
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all border border-blue-100/50">
            <div className="text-blue-600">
                {icon}
            </div>
        </div>
        <h3 className="text-xl font-extrabold mb-3 text-slate-800">{title}</h3>
        <p className="text-slate-500 font-medium text-sm leading-relaxed">{description}</p>
    </motion.div>
);

export default Home;
