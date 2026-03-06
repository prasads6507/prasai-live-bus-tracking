import { useState, useEffect } from 'react';
import { User, Building, Mail, LogOut, Info } from 'lucide-react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { validateSlug } from '../services/api';
import { motion } from 'framer-motion';

const Settings = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [user, setUser] = useState<any>(null);
    const [orgName, setOrgName] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const org = localStorage.getItem('orgName');

        if (storedUser) setUser(JSON.parse(storedUser));

        if (org) {
            setOrgName(org);
        } else if (orgSlug) {
            // Fallback: Fetch org name if not in local storage
            validateSlug(orgSlug).then(data => {
                setOrgName(data.collegeName);
                localStorage.setItem('orgName', data.collegeName);
            }).catch(err => console.error("Failed to fetch org details", err));
        }
    }, [orgSlug]);

    const logout = () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            window.location.href = '/';
        }
    };

    return (
        <Layout activeItem="settings">
            <div className="p-6">
                <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 border border-emerald-100/50 rounded-2xl text-emerald-600 shadow-sm">
                                <Info size={24} />
                            </div>
                            Settings
                        </h1>
                        <p className="text-slate-500 mt-1 ml-14">Manage your profile and preferences</p>
                    </div>
                </div>

                    {/* Profile Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <User className="text-emerald-600" size={20} />
                                My Profile
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 text-2xl font-black shadow-sm">
                                    {user?.name?.charAt(0) || 'A'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{user?.name || 'Administrator'}</h3>
                                    <span className="inline-block mt-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100/50">
                                        {user?.role?.replace('_', ' ') || 'COLLEGE ADMIN'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                        <Mail size={16} /> Email Address
                                    </label>
                                    <div className="p-3 bg-slate-50 rounded-lg text-slate-800 border border-slate-200">
                                        {user?.email || 'admin@example.com'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Organization Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <Building className="text-purple-600" size={20} />
                                Organization Details
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-500">College Name</label>
                                    <div className="p-3 bg-slate-50 rounded-lg text-slate-800 border border-slate-200 font-medium">
                                        {orgName || 'Loading...'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-500">College ID (Slug)</label>
                                    <div className="p-3 bg-slate-50 rounded-lg text-slate-600 border border-slate-200 font-mono text-sm">
                                        {user?.collegeId || 'unknown-id'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* App Info & Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                                <Info className="text-slate-600" size={20} />
                                Application Info
                            </h2>
                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span>Version</span>
                                    <span className="font-mono">v1.0.0</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span>Support</span>
                                    <span className="text-emerald-600">support@prasai.com</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center group">
                            <motion.button
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={logout}
                                className="flex items-center gap-3 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 px-8 py-4 rounded-xl font-bold transition-all w-full justify-center shadow-sm hover:shadow-md"
                            >
                                <LogOut size={22} />
                                <span className="uppercase tracking-widest text-xs">Sign Out</span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
