import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { registerUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await registerUser({ name, email, passwordHash: password });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50 font-sans selection:bg-blue-100 italic">
            {/* Left Visual Side - Branding Hero */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center p-12">
                {/* Dynamic Background Elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] animate-pulse duration-[5000ms]"></div>

                <div className="relative z-10 text-center max-w-lg">
                    <div className="mb-10 inline-block p-6 bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 shadow-2xl animate-in zoom-in duration-1000">
                        <img src="/logo.png" alt="Prasai Logo" className="w-32 h-32" />
                    </div>
                    <h1 className="text-7xl font-black text-white tracking-tighter mb-4 italic translate-y-[-10px]">
                        Prasai
                    </h1>
                    <p className="text-indigo-400 text-xl font-bold uppercase tracking-[0.3em] mb-8 font-serif">
                        Live Bus Tracking
                    </p>
                    <div className="space-y-4">
                        <div className="h-1 w-20 bg-indigo-600 mx-auto rounded-full"></div>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Join the future of campus transit management. Register your institution today.
                        </p>
                    </div>
                </div>

                {/* Floating Abstract Shape */}
                <div className="absolute top-1/4 right-10 w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-3xl rotate-12 opacity-20 blur-sm"></div>
                <div className="absolute bottom-1/4 left-10 w-16 h-16 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-full opacity-10 blur-md"></div>
            </div>

            {/* Right Auth Side */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 sm:p-8 md:p-12 lg:p-16 xl:p-20 bg-white relative min-h-screen lg:min-h-0">
                {/* Mobile Identity */}
                <div className="lg:hidden flex flex-col items-center mb-6 sm:mb-8">
                    <img src="/logo.png" alt="Prasai Logo" className="w-16 h-16 sm:w-20 sm:h-20 mb-2" />
                    <h1 className="text-3xl sm:text-4xl font-black text-blue-600 tracking-tight italic">Prasai</h1>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Live Bus Tracking</p>
                </div>

                <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-700">
                    <div className="mb-6 sm:mb-8 lg:text-left text-center">
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">Create Account</h2>
                        <p className="text-slate-500 font-medium italic text-sm sm:text-base">Register your institution to get started</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl mb-6 text-sm flex items-center shadow-sm">
                            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Full Name</label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 transition-all font-medium text-base"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Email Address</label>
                            <input
                                type="email"
                                placeholder="name@organization.com"
                                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 transition-all font-medium text-base"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 transition-all font-medium text-base"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Confirm</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 transition-all font-medium text-base"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl text-base sm:text-lg font-black hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:scale-[0.98] transition-all transform duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm font-medium text-slate-500 italic">
                        Already have an account? <Link to="/login" className="text-blue-600 hover:text-blue-800 font-black not-italic underline ml-1">Sign In</Link>
                    </div>

                    {/* Footer Branding */}
                    <div className="mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
                            © 2026 Prasai
                        </p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-tighter mt-1 opacity-60">
                            Live Bus Tracking. All rights reserved globally.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
