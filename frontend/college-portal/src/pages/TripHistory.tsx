import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Bus, User, Calendar, RefreshCw } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { getTripHistory } from '../services/api';

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
                // Refetch when any bus document changes (trip start/end updates bus status)
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

    return (
        <Layout activeItem="trip-history">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Trip History</h1>
                        <p className="text-slate-500 mt-1">View all trip records with timestamps and status</p>
                    </div>
                    <button
                        onClick={fetchTrips}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Last Updated */}
                <div className="text-sm text-slate-500 mb-4">
                    Last updated: {lastRefresh.toLocaleTimeString()}
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && trips.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <RefreshCw size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-slate-500">Loading trip history...</p>
                    </div>
                ) : trips.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <Clock size={48} className="text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No trips recorded yet</p>
                        <p className="text-sm text-slate-400 mt-1">Trips will appear here when drivers start their journeys</p>
                    </div>
                ) : (
                    /* Trip Table */
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Bus
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Driver
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Start Time
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            End Time
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Duration
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {trips.map((trip) => (
                                        <tr key={trip._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                        <Bus size={20} />
                                                    </div>
                                                    <span className="font-medium text-slate-800">{trip.busNumber}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-slate-400" />
                                                    <span className="text-slate-700">{trip.driverName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-green-500" />
                                                    <span className="text-slate-700">{formatDateTime(trip.startTime)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-red-400" />
                                                    <span className="text-slate-700">{formatDateTime(trip.endTime)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-600">{formatDuration(trip.durationMinutes)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {trip.status === 'ACTIVE' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                        On Trip
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                        Off Trip
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                {trips.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Total Trips</p>
                                    <p className="text-xl font-bold text-slate-800">{trips.length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                                    <Bus size={20} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Active Trips</p>
                                    <p className="text-xl font-bold text-slate-800">
                                        {trips.filter(t => t.status === 'ACTIVE').length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Completed Trips</p>
                                    <p className="text-xl font-bold text-slate-800">
                                        {trips.filter(t => t.status === 'COMPLETED').length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default TripHistory;
