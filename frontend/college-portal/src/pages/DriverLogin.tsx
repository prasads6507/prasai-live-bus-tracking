import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, Bus } from 'lucide-react';
import { login, validateSlug } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const DriverLogin = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);
    const [orgDetails, setOrgDetails] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkSlug = async () => {
            if (!orgSlug) return;
            try {
                const data = await validateSlug(orgSlug);
                setOrgDetails(data);
                if (data.status === 'SUSPENDED') {
                    setError('This organization account is currently suspended.');
                }
            } catch (err) {
                console.error("Slug Validation Failed:", err);
                setError('Organization not found. Please check the URL.');
            } finally {
                setValidating(false);
            }
        };
        checkSlug();
    }, [orgSlug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgDetails || error) return;

        setLoading(true);
        setError('');

        try {
            const data = await login({ email, password });

            // STRICT ROLE CHECK FOR DRIVERS
            if (data.role !== 'DRIVER') {
                throw new Error('Access Denied. This login is for DRIVERS only.');
            }

            if (data.collegeId !== orgDetails.collegeId) {
                throw new Error('You do not belong to this organization.');
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('current_college_id', data.collegeId); // Ensure context is consistent

            navigate(`/${orgSlug}/driver-dashboard`);

        } catch (err: any) {
            console.error("Login Failed:", err);
            setError(err.response?.data?.message || err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    // --- Loading State ---
    if (validating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    // --- Error State ---
    if (!orgDetails && error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-4">
                <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="bg-red-100 p-4 rounded-full mb-6"
                >
                    <AlertCircle className="text-red-600 w-12 h-12" />
                </motion.div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Organization Not Found</h1>
                <p className="text-slate-500 mb-6 max-w-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden font-sans">
            {/* Left Side - Driver Hero Section */}
            <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="lg:w-1/2 bg-slate-900 relative flex flex-col justify-center items-center p-12 text-white overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500 rounded-full blur-[128px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[128px]"></div>
                </div>

                <div className="relative z-10 text-center max-w-lg">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-2xl"
                    >
                        <Bus className="w-10 h-10 text-green-400" />
                    </motion.div>

                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                        Driver Portal
                    </h1>

                    <p className="text-lg text-slate-300 mb-8 font-light">
                        {orgDetails?.collegeName} <br />
                        Secure login for authorized fleet drivers only.
                    </p>
                </div>
            </motion.div>

            {/* Right Side - Login Form */}
            <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-slate-50">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-10"
                >
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-800">Driver Sign In</h2>
                        <p className="text-slate-500 mt-2">Enter credentials to start your shift</p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r text-sm flex items-start"
                            >
                                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-green-500 outline-none transition-all"
                                    placeholder="driver@transport.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-green-500 outline-none transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="submit"
                                disabled={loading}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center space-x-2 transition-all ${loading
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-green-200'
                                    }`}
                            >
                                {loading ? (
                                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        <span>Start Driving</span>
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
};

export default DriverLogin;
