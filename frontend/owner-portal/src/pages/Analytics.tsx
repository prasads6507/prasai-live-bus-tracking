import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAnalytics } from '../services/owner.service';

const Analytics: React.FC = () => {
    const [metrics, setMetrics] = useState<any[]>([]);
    const [stats, setStats] = useState({ revenue: 0, systemHealth: { api: '-', db: '-' } });
    const [reportType, setReportType] = useState('MONTHLY');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await getAnalytics();
                setMetrics(response.metrics || []);
                setStats({
                    revenue: response.revenue || 0,
                    systemHealth: response.systemHealth || { api: 'Unknown', db: 'Unknown' }
                });
            } catch (error) {
                console.error('Failed to load analytics', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleDownload = () => {
        const headers = ['College,Buses,Students,Trips'];
        const rows = metrics.map(m => `${m.name},${m.buses},${m.students},${m.trips}`);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `platform_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Platform Analytics</h1>
                    <p className="text-sm text-gray-500">Real-time performance metrics</p>
                </div>
                <div className="space-x-4">
                    <select
                        className="border rounded-lg px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                    >
                        <option value="WEEKLY">Weekly View</option>
                        <option value="MONTHLY">Monthly View</option>
                        <option value="YEARLY">Yearly View</option>
                    </select>
                    <button
                        onClick={handleDownload}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm font-bold flex items-center inline-flex"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Report
                    </button>
                </div>
            </div>

            {/* Charts Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Organization Performance</h3>
                <div className="h-96 w-full">
                    {metrics.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={metrics}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                <Legend />
                                <Bar dataKey="students" fill="#2563EB" name="Active Students" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="trips" fill="#10B981" name="Daily Trips (Est)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="buses" fill="#F59E0B" name="Active Buses" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <p>No data available yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-700">System Health Status</h3>
                        {stats.systemHealth.db === 'Stable' ? (
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full uppercase">Operational</span>
                        ) : (
                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full uppercase">Issues Detected</span>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                            <span className="text-gray-500">API Response Latency</span>
                            <span className="font-mono font-bold text-blue-600">{stats.systemHealth.api}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-gray-500">Database Connectivity</span>
                            <span className={`font-bold ${stats.systemHealth.db === 'Stable' ? 'text-green-600' : 'text-red-500'}`}>
                                {stats.systemHealth.db}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-300 mb-1">Monthly Recurring Revenue (Est.)</h3>
                    <p className="text-4xl font-extrabold mb-4">${stats.revenue.toLocaleString()}.00</p>
                    <div className="inline-flex items-center bg-slate-800 rounded-lg px-3 py-1 text-sm border border-slate-700">
                        <span className="text-green-400 font-bold mr-2">↑ 12%</span>
                        <span className="text-slate-400">vs last month</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
