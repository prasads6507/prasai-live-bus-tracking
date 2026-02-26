import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell
} from 'recharts';
import {
    getFirebaseUsageOverview,
    getFirebaseUsageCost
} from '../services/owner.service';
import {
    HiTrendingUp, HiDocumentReport, HiCurrencyDollar,
    HiDatabase, HiExclamationCircle, HiCalendar
} from 'react-icons/hi';

const FirebaseUsage: React.FC = () => {
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [usage, setUsage] = useState<any>(null);
    const [cost, setCost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usageRes, costRes] = await Promise.all([
                getFirebaseUsageOverview(month),
                getFirebaseUsageCost(month)
            ]);
            setUsage(usageRes);
            setCost(costRes);
        } catch (error) {
            console.error('Failed to load usage data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [month]);

    const chartData = usage ? [
        { name: 'Reads', count: usage.totalReads, fill: '#3B82F6' },
        { name: 'Writes', count: usage.totalWrites, fill: '#10B981' },
        { name: 'Deletes', count: usage.totalDeletes, fill: '#EF4444' },
    ] : [];

    if (loading && !usage) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Firebase Usage & Cost</h1>
                    <p className="text-sm text-slate-500">Project-level monitoring and billing</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200">
                    <HiCalendar className="text-slate-400" size={20} />
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="outline-none text-slate-700 font-semibold cursor-pointer"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <HiDatabase size={24} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Document Reads</p>
                    <h3 className="text-2xl font-bold text-slate-800">{(usage?.totalReads || 0).toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <HiTrendingUp size={24} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Document Writes</p>
                    <h3 className="text-2xl font-bold text-slate-800">{(usage?.totalWrites || 0).toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                            <HiDocumentReport size={24} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Document Deletes</p>
                    <h3 className="text-2xl font-bold text-slate-800">{(usage?.totalDeletes || 0).toLocaleString()}</h3>
                </div>

                <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-600 rounded-xl text-white">
                            <HiCurrencyDollar size={24} />
                        </div>
                        {cost?.note && (
                            <div className="group relative">
                                <HiExclamationCircle className="text-slate-400 hover:text-white cursor-help" size={20} />
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
                                    {cost.note}
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Total Project Cost</p>
                    <h3 className="text-2xl font-bold">
                        {cost?.currency === 'USD' ? '$' : (cost?.currency || '')}
                        {(cost?.totalCostThisMonth || 0).toFixed(2)}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                        {cost?.note ? "Estimate / No Billing Export" : "Actual Cost"}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Usage Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Firestore Operations</h3>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#F8FAFC' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={60}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Details / Billing Status */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Execution Details</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500 font-medium">Firestore Data</span>
                                <span className="text-slate-800 font-bold uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded">v1</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Metrics are retrieved from Google Cloud Monitoring. Data represents physical document operations across the entire project.
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500 font-medium">Billing Export</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${cost?.note ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {cost?.note ? "Disabled" : "Live Sync"}
                                </span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    {cost?.note ? (
                                        "Billing data is currently showing safe defaults. Enable BigQuery Billing Export in the GCP console for accurate financial tracking."
                                    ) : (
                                        `Connected to BigQuery dataset ${import.meta.env.VITE_BILLING_EXPORT_NAME || 'BillingSync'}. Financial totals are updated within 24 hours.`
                                    )}
                                </p>
                            </div>
                        </div>

                        {cost?.firestoreCostThisMonth !== undefined && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Firestore Specific Cost</span>
                                    <span className="text-slate-800 font-bold">
                                        {cost?.currency === 'USD' ? '$' : (cost?.currency || '')}
                                        {cost.firestoreCostThisMonth.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FirebaseUsage;
