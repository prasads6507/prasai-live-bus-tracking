import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/owner.service';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({
        totalColleges: 0,
        activeColleges: 0,
        totalBuses: 0,
        totalStudents: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-10 text-white shadow-2xl">
                <div className="relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Network Intelligence</h1>
                    <p className="text-slate-400 max-w-lg text-lg">
                        Real-time oversight of the Prasai ecosystem. Monitor organization growth, fleet capacity, and community connectivity from a single command center.
                    </p>
                </div>
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 ml-10 mb-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
            </div>

            {/* Platform Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Partner Organizations */}
                <div className="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div className="p-3 bg-blue-100 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Growth</span>
                    </div>
                    <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">Organizations</h3>
                    <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-4xl font-black text-slate-800">{stats.totalColleges}</span>
                        <span className="text-xs font-bold text-green-500">+{stats.activeColleges} Active</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-4 font-medium italic">Partner institutions onboarded</p>
                </div>

                {/* Fleet Strength */}
                <div className="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m4-4l-4-4" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">Resources</span>
                    </div>
                    <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">Fleet Strength</h3>
                    <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-4xl font-black text-slate-800">{stats.totalBuses}</span>
                        <span className="text-xs font-bold text-indigo-400">Total Units</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-4 font-medium italic">Active transit units in network</p>
                </div>

                {/* Active Ridership */}
                <div className="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">Community</span>
                    </div>
                    <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">Active Ridership</h3>
                    <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-4xl font-black text-slate-800">{stats.totalStudents}</span>
                        <span className="text-xs font-bold text-emerald-400">Total Users</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-4 font-medium italic">Students served across regions</p>
                </div>

                {/* System Integrity */}
                <div className="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div className="p-3 bg-purple-100 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-widest">Security</span>
                    </div>
                    <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider">System Integrity</h3>
                    <div className="flex items-baseline mt-1">
                        <span className="text-xl font-black text-emerald-600">OPERATIONAL</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-6 font-medium italic">Last heartbeat: Just now</p>
                </div>
            </div>

            {/* Quick Actions / Summary Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-2 text-white">Prasai Global Reach</h2>
                            <p className="text-blue-100/70 text-sm max-w-md">Our network is expanding across 3 unique sectors. You have full administrative control over all provisioned organizations.</p>
                        </div>
                        <div className="mt-10 flex space-x-6">
                            <div className="flex flex-col">
                                <span className="text-3xl font-black">100%</span>
                                <span className="text-[10px] font-bold uppercase text-blue-200 tracking-widest">Uptime</span>
                            </div>
                            <div className="flex flex-col border-l border-white/20 pl-6">
                                <span className="text-3xl font-black">{stats.totalColleges}</span>
                                <span className="text-[10px] font-bold uppercase text-blue-200 tracking-widest">Nodes</span>
                            </div>
                        </div>
                    </div>
                    {/* Abstract background shape */}
                    <div className="absolute bottom-0 right-0 -mr-10 -mb-10 w-48 h-48 bg-white/10 rounded-full blur-2xl transform rotate-12"></div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col justify-center text-center">
                    <h4 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">Current Focus</h4>
                    <p className="text-slate-600 font-medium italic mb-6">"Enhancing multi-tenant onboarding while maintaining peak system performance."</p>
                    <div className="flex justify-center -space-x-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-10 w-10 rounded-full border-2 border-white bg-slate-${200 + i * 100} flex items-center justify-center text-[10px] font-bold text-slate-500`}>
                                P{i}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
