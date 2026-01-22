import { useState, useEffect } from 'react';
import { User, Shield, Building, Mail, Phone, LogOut, Info } from 'lucide-react';
import Layout from '../components/Layout';

const Settings = () => {
    const [user, setUser] = useState<any>(null);
    const [orgName, setOrgName] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const org = localStorage.getItem('orgName');
        if (storedUser) setUser(JSON.parse(storedUser));
        if (org) setOrgName(org);
    }, []);

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
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Settings</h1>
                        <p className="text-slate-500">Manage your profile and preferences</p>
                    </div>

                    {/* Profile Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <User className="text-blue-600" size={20} />
                                My Profile
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                                    {user?.name?.charAt(0) || 'A'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{user?.name || 'Administrator'}</h3>
                                    <span className="inline-block mt-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                                        {user?.role || 'COLLEGE_ADMIN'}
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
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                        <Phone size={16} /> Phone Number
                                    </label>
                                    <div className="p-3 bg-slate-50 rounded-lg text-slate-800 border border-slate-200">
                                        {user?.phone || 'Not provided'}
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
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span>Environment</span>
                                    <span className="capitalize">{import.meta.env.MODE}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span>Support</span>
                                    <span className="text-blue-600">support@bannu.com</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-center">
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-6 py-3 rounded-xl font-semibold transition-all w-full justify-center"
                            >
                                <LogOut size={20} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
