import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Bus, Calendar, RefreshCw, Trash2, Download, Map } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout';
import { getTripHistory, bulkDeleteTrips } from '../services/api';

interface Trip {
    _id: string;
    busId: string;
    busNumber: string;
    driverName: string;
    startTime: string;
    endTime: string | null;
    status: 'ACTIVE' | 'COMPLETED';
    durationMinutes: number | null;
}

const TripHistory = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
    const [pageSize, setPageSize] = useState(10);
    const [pageIndex, setPageIndex] = useState(1);
    const [actionLoading, setActionLoading] = useState(false);

    // Reporting
    const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'year'>('week');

    // Verify auth on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate(`/${orgSlug}/login`);
        }
    }, [orgSlug, navigate]);

    // Fetch trip history
    const fetchTrips = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getTripHistory();
            if (response.success) {
                setTrips(response.data);
            }
            setLastRefresh(new Date());
        } catch (err: any) {
            console.error('Error fetching trips:', err);
            setError(err.response?.data?.message || 'Failed to load trip history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrips();

        // Set up real-time listener for buses collection to detect trip changes
        const collegeId = localStorage.getItem('current_college_id');
        if (collegeId) {
            const busesRef = collection(db, 'buses');
            const q = query(busesRef, where('collegeId', '==', collegeId));

            const unsubscribe = onSnapshot(q, () => {
                fetchTrips();
            });

            return () => unsubscribe();
        }
    }, []);

    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDuration = (minutes: number | null) => {
        if (minutes === null) return '—';
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const handleBulkDelete = async () => {
        if (selectedTripIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedTripIds.length} trip record(s)? This action cannot be undone.`)) return;

        setActionLoading(true);
        try {
            await bulkDeleteTrips(selectedTripIds);
            setSelectedTripIds([]);
            fetchTrips();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to delete trips');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePreview = () => {
        if (selectedTripIds.length !== 1) return;
        navigate(`/${orgSlug}/trips/${selectedTripIds[0]}`);
    };

    // Filter and Paginate
    const filteredTrips = trips.filter(t => {
        if (!t.startTime) return false;
        const tripDate = new Date(t.startTime);
        const now = new Date();
        const start = new Date();

        switch (reportPeriod) {
            case 'today': start.setHours(0, 0, 0, 0); break;
            case 'week': start.setDate(now.getDate() - 7); break;
            case 'month': start.setMonth(now.getMonth() - 1); break;
            case 'year': start.setFullYear(now.getFullYear() - 1); break;
        }
        return tripDate >= start && tripDate <= now;
    });

    const totalPages = Math.ceil(filteredTrips.length / pageSize);
    const paginatedTrips = filteredTrips.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

    const toggleSelectAll = () => {
        if (selectedTripIds.length === paginatedTrips.length && paginatedTrips.length > 0) {
            setSelectedTripIds([]);
        } else {
            setSelectedTripIds(paginatedTrips.map(t => t._id));
        }
    };

    const toggleSelectTrip = (tripId: string) => {
        setSelectedTripIds(prev =>
            prev.includes(tripId) ? prev.filter(id => id !== tripId) : [...prev, tripId]
        );
    };

    const downloadReport = () => {
        const now = new Date();
        const start = new Date();

        switch (reportPeriod) {
            case 'today': start.setHours(0, 0, 0, 0); break;
            case 'week': start.setDate(now.getDate() - 7); break;
            case 'month': start.setMonth(now.getMonth() - 1); break;
            case 'year': start.setFullYear(now.getFullYear() - 1); break;
        }

        const filteredForDownload = trips.filter(t => {
            if (!t.startTime) return false;
            const tripDate = new Date(t.startTime);
            return tripDate >= start && tripDate <= now;
        });

        const data = filteredForDownload.map(t => ({
            'Bus Number': t.busNumber,
            'Driver': t.driverName,
            'Start Time': formatDateTime(t.startTime),
            'End Time': formatDateTime(t.endTime),
            'Duration': formatDuration(t.durationMinutes),
            'Status': t.status
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        const wscols = [
            { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, 'Trip Report');
        XLSX.writeFile(wb, `Trips_Report_${reportPeriod}_${now.toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <Layout activeItem="trip-history">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Trip History</h1>
                        <p className="text-slate-500 mt-1">View all trip records with timestamps and status</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                            {(['today', 'week', 'month', 'year'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setReportPeriod(period)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${reportPeriod === period
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={downloadReport}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <Download size={16} />
                            Download Report
                        </button>

                        <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block"></div>

                        <button
                            onClick={fetchTrips}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Bulk Action Bar */}
                {selectedTripIds.length > 0 && (
                    <div className="bg-blue-600 px-6 py-3 rounded-xl shadow-lg flex items-center justify-between mb-6 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-4">
                            <span className="text-white font-bold">{selectedTripIds.length} record(s) selected</span>
                            <div className="h-4 w-px bg-white/30" />
                            <button
                                onClick={() => setSelectedTripIds([])}
                                className="text-white/80 hover:text-white text-sm font-medium transition-all"
                            >
                                Clear selection
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            {selectedTripIds.length === 1 && (
                                <button
                                    onClick={handlePreview}
                                    className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                                >
                                    <Map size={16} />
                                    Preview Details
                                </button>
                            )}
                            <button
                                onClick={handleBulkDelete}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                                {actionLoading ? 'Deleting...' : 'Delete Selected'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Row */}
                <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                    <div className="text-sm text-slate-500">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                        Showing {paginatedTrips.length} of {filteredTrips.length} trips
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Main Content */}
                {loading && trips.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <RefreshCw size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-slate-500">Loading trip history...</p>
                    </div>
                ) : trips.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <Clock size={48} className="text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No trips recorded yet</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                                checked={selectedTripIds.length === paginatedTrips.length && paginatedTrips.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Bus</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Time</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">End Time</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedTrips.map((trip) => (
                                        <tr key={trip._id} className={`hover:bg-slate-50 transition-colors ${selectedTripIds.includes(trip._id) ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                                    checked={selectedTripIds.includes(trip._id)}
                                                    onChange={() => toggleSelectTrip(trip._id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-800">{trip.busNumber}</td>
                                            <td className="px-6 py-4 text-slate-700">{trip.driverName}</td>
                                            <td className="px-6 py-4 text-slate-600">{formatDateTime(trip.startTime)}</td>
                                            <td className="px-6 py-4 text-slate-600">{formatDateTime(trip.endTime)}</td>
                                            <td className="px-6 py-4 text-slate-600">{formatDuration(trip.durationMinutes)}</td>
                                            <td className="px-6 py-4">
                                                {trip.status === 'ACTIVE' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                        On Trip
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                                        Off Trip
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => navigate(`/${orgSlug}/trips/${trip._id}`)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Map size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('Delete this trip record?')) {
                                                                bulkDeleteTrips([trip._id]).then(() => fetchTrips());
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-500">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPageIndex(1);
                                    }}
                                    className="bg-white border border-slate-200 text-sm rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {[10, 20, 30, 40, 50].map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-500">
                                    Page {pageIndex} of {Math.max(1, totalPages)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={pageIndex <= 1}
                                        onClick={() => setPageIndex(p => p - 1)}
                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-30"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        disabled={pageIndex >= totalPages}
                                        onClick={() => setPageIndex(p => p + 1)}
                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-white disabled:opacity-30"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                {trips.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Total Trips</p>
                                <p className="text-xl font-bold text-slate-800">{filteredTrips.length}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                                <Bus size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Active</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {filteredTrips.filter(t => t.status === 'ACTIVE').length}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Completed</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {filteredTrips.filter(t => t.status === 'COMPLETED').length}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default TripHistory;
