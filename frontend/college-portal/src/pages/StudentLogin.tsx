import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, LogIn, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { validateSlug, studentLogin, studentSetPassword } from '../services/api';

const StudentLogin = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();

    const [college, setCollege] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loginError, setLoginError] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    // Set Password Modal
    const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [setPasswordLoading, setSetPasswordLoading] = useState(false);

    useEffect(() => {
        const checkSlug = async () => {
            if (!orgSlug) {
                setError('Organization not specified');
                setLoading(false);
                return;
            }
            try {
                const collegeData = await validateSlug(orgSlug);
                if (collegeData.status !== 'ACTIVE') {
                    setError('This organization is currently inactive.');
                } else {
                    setCollege(collegeData);
                }
            } catch (err: any) {
                setError(err.response?.data?.message || 'Organization not found');
            } finally {
                setLoading(false);
            }
        };
        checkSlug();
    }, [orgSlug]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        try {
            const data = await studentLogin(email, password, orgSlug || '');

            if (data.isFirstLogin) {
                // Store temp token for set-password call
                localStorage.setItem('token', data.token); // Needed for interceptor
                localStorage.setItem('current_college_id', data.collegeId);
                setShowSetPasswordModal(true);
            } else {
                // Normal login, go to dashboard
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data));
                localStorage.setItem('current_college_id', data.collegeId);
                navigate(`/${orgSlug}/student/dashboard`);
            }
        } catch (err: any) {
            setLoginError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleSetPassword = async () => {
        setPasswordError('');

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match. Please re-enter.');
            return;
        }

        setSetPasswordLoading(true);

        try {
            await studentSetPassword(newPassword);
            // Success! Navigate to dashboard
            setShowSetPasswordModal(false);
            navigate(`/${orgSlug}/student/dashboard`);
        } catch (err: any) {
            setPasswordError(err.response?.data?.message || 'Failed to set password');
        } finally {
            setSetPasswordLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <Bus size={40} className="text-blue-500 animate-pulse" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
                <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-md">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
                    <p className="text-slate-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        <Bus size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Student Login</h1>
                    <p className="text-slate-500 mt-1">{college?.collegeName}</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    {loginError && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                            <span>{loginError}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="student@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Enter your password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">First login? Use your Register Number as password.</p>
                    </div>

                    <motion.button
                        type="submit"
                        disabled={loginLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3 mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loginLoading ? 'Signing in...' : <><LogIn size={20} /> Sign In</>}
                    </motion.button>
                </form>
            </motion.div>

            {/* Set Password Modal */}
            <AnimatePresence>
                {showSetPasswordModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <KeyRound size={32} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800">Set New Password</h2>
                                <p className="text-slate-500 mt-1">Create a secure password for your account.</p>
                            </div>

                            <div className="space-y-4">
                                {passwordError && (
                                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-lg text-sm">
                                        {passwordError}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        placeholder="At least 6 characters"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Re-enter New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        placeholder="Confirm your password"
                                    />
                                </div>

                                <motion.button
                                    onClick={handleSetPassword}
                                    disabled={setPasswordLoading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-3 mt-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-200 disabled:opacity-50"
                                >
                                    {setPasswordLoading ? 'Setting Password...' : 'Set Password & Continue'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StudentLogin;
