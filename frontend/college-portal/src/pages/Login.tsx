import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, School, Bus } from 'lucide-react';
import { login, validateSlug } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
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

            // Redirect DRIVERS to Driver Dashboard
            if (data.role === 'DRIVER') {
                // Store user info specifically for driver portal
                localStorage.setItem('driver_token', data.token);
                const userToStore = {
                    _id: data._id,
                    name: data.name,
                    email: data.email,
                    role: data.role,
                    collegeId: data.collegeId
                };
                localStorage.setItem('driver_user', JSON.stringify(userToStore));
                localStorage.setItem('current_college_id', orgDetails.collegeId);
                localStorage.setItem('orgName', orgDetails.collegeName);

                // Redirect to driver dashboard
                navigate(`/${orgSlug}/driver-dashboard`);
                return;
            }

            // Only allow COLLEGE_ADMIN role or OWNER
            // We check specifically for OWNER or COLLEGE_ADMIN
            if (data.role !== 'COLLEGE_ADMIN' && data.role !== 'OWNER' && data.role !== 'SUPER_ADMIN') {
                throw new Error(`Access Denied. Your role '${data.role}' is not authorized.`);
            }

            if (data.role !== 'OWNER' && data.role !== 'SUPER_ADMIN' && data.collegeId !== orgDetails.collegeId) {
                throw new Error('You do not have access to this organization.');
            }

            // Store user info and org name
            localStorage.setItem('token', data.token);
            // Backend returns flat user object, not nested 'user' key
            const userToStore = {
                _id: data._id,
                name: data.name,
                email: data.email,
                role: data.role,
                collegeId: data.collegeId
            };
            localStorage.setItem('user', JSON.stringify(userToStore));
            localStorage.setItem('current_college_id', orgDetails.collegeId);
            localStorage.setItem('orgName', orgDetails.collegeName); // Save College Name for Settings

            // Set default headers for subsequent requests
            // (Verify if api has setHeader method or if we reload)

            navigate(`/${orgSlug}/dashboard`);

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
                <div className="bg-white px-6 py-3 rounded-lg border border-slate-200 shadow-sm font-mono text-sm text-slate-600">
                    /{orgSlug}/login
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden font-sans">

            {/* Left Side - Hero Section */}
            <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="hidden lg:flex lg:w-1/2 bg-slate-900 relative flex-col justify-center items-center p-12 text-white overflow-hidden"
            >
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[128px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[128px]"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 text-center max-w-lg">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-2xl"
                    >
                        <School className="w-10 h-10 text-blue-400" />
                    </motion.div>

                    <motion.h1
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight tracking-tight"
                    >
                        {orgDetails?.collegeName}
                    </motion.h1>

                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-lg text-slate-300 mb-8 font-light"
                    >
                        Welcome to the official administration portal. Securely manage your fleet, drivers, and campus transport network.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex items-center justify-center space-x-2 text-sm text-slate-400 bg-slate-800/50 py-2 px-4 rounded-full"
                    >
                        <ShieldCheck size={16} className="text-green-400" />
                        <span>Powered by Prasai Secure Transport</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-slate-50 min-h-screen lg:min-h-0">
                {/* Mobile Header */}
                <div className="lg:hidden absolute top-0 left-0 right-0 bg-slate-900 text-white p-4 flex items-center justify-center gap-3">
                    <School className="w-6 h-6 text-blue-400" />
                    <span className="font-bold text-lg truncate max-w-[200px]">{orgDetails?.collegeName}</span>
                </div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 lg:p-10 mt-16 lg:mt-0"
                >
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-800">Admin Sign In</h2>
                        <p className="text-slate-500 mt-2">Enter your credentials to access the dashboard</p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r text-sm flex items-start overflow-hidden"
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
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-12 pr-4 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400 text-base"
                                    placeholder="admin@college.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-semibold text-slate-700">Password</label>
                                <a href="#" className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">Forgot password?</a>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-12 pr-4 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400 text-base"
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
                                disabled={loading || !!error}
                                className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg flex items-center justify-center space-x-2 transition-all ${loading || error
                                    ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-200'
                                    }`}
                            >
                                {loading ? (
                                    <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        <span>Sign In to Dashboard</span>
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
                            <Bus size={14} />
                            <span>Live Tracking Platform v1.0</span>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
