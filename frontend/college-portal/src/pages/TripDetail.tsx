import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Bus, User, RefreshCw, Trash2,
    ArrowLeft, Map as MapIcon, Navigation, Activity,
    AlertCircle, CheckCircle2, StopCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import MapLibreMap from '../components/MapLibreMap';
import { getTripPath, getTripHistory, adminEndTrip, bulkDeleteTrips } from '../services/api';

interface Trip {
    _id: string;
    busId: string;
    busNumber: string;
    driverName: string;
    startTime: string;
    endTime: string | null;
    status: 'ACTIVE' | 'COMPLETED';
    durationMinutes: number | null;
    collegeId: string;
    maxSpeed?: number;
}

const TripDetail = () => {
    const { orgSlug, tripId } = useParams<{ orgSlug: string, tripId: string }>();
    const navigate = useNavigate();

    const [trip, setTrip] = useState<Trip | null>(null);
    const [path, setPath] = useState<[number, number][]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = async () => {
        if (!tripId) return;
        try {
            setLoading(true);
            setError(null);

            // 1. Get Trip Data (from list for now, or specific endpoint if exists)
            const historyResponse = await getTripHistory();
            if (historyResponse.success) {
                const foundTrip = historyResponse.data.find((t: Trip) => t._id === tripId);
                if (foundTrip) {
                    setTrip(foundTrip);
                } else {
                    setError('Trip not found');
                    return;
                }
            }

            // 2. Get Path Data
            const pathResponse = await getTripPath(tripId);
            if (pathResponse.success && Array.isArray(pathResponse.data)) {
                const pathPoints = pathResponse.data
                    .map((p: any) => {
                        const lat = Number(p.lat ?? p.latitude);
                        const lng = Number(p.lng ?? p.longitude);
                        return [lat, lng];
                    })
                    .filter((coords: number[]) => Number.isFinite(coords[0]) && Number.isFinite(coords[1])) as [number, number][];
                setPath(pathPoints);
            }

            setLastUpdated(new Date());
        } catch (err: any) {
            console.error('Error fetching trip details:', err);
            setError(err.response?.data?.message || 'Failed to load trip data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Auto-refresh for active trips
        let interval: any;
        if (trip?.status === 'ACTIVE') {
            interval = setInterval(fetchData, 10000); // 10s refresh
        }
        return () => clearInterval(interval);
    }, [tripId, trip?.status]);

    const handleEndTrip = async () => {
        if (!tripId || !window.confirm('Are you sure you want to force-end this trip?')) return;
        setActionLoading(true);
        try {
            await adminEndTrip(tripId);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to end trip');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteTrip = async () => {
        if (!tripId || !window.confirm('Delete this trip record? This cannot be undone.')) return;
        setActionLoading(true);
        try {
            await bulkDeleteTrips([tripId]);
            navigate(`/${orgSlug}/trip-history`);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete trip');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return 'Ongoing';
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDuration = (minutes: number | null) => {
        if (minutes === null) return 'Ongoing';
        if (minutes < 60) return `${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    if (loading && !trip) {
        return (
            <Layout activeItem="trip-history">
                <div className="flex items-center justify-center h-[80vh]">
                    <div className="text-center">
                        <RefreshCw size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium text-lg">Loading trip details...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (error || !trip) {
        return (
            <Layout activeItem="trip-history">
                <div className="p-8 max-w-4xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Trip</h2>
                        <p className="text-red-600 mb-6">{error || 'Trip details could not be found.'}</p>
                        <button
                            onClick={() => navigate(`/${orgSlug}/trip-history`)}
                            className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg mx-auto"
                        >
                            <ArrowLeft size={18} />
                            Back to History
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout activeItem="trip-history">
            <div className="h-[calc(100vh-64px)] flex flex-col xl:flex-row overflow-hidden">
                {/* Sidebar - Trip Info */}
                <div className="w-full xl:w-[400px] bg-white border-r border-slate-200 overflow-y-auto shrink-0 z-10 shadow-xl">
                    <div className="p-6">
                        <button
                            onClick={() => navigate(`/${orgSlug}/trip-history`)}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors group"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-medium">Back to History</span>
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${trip.status === 'ACTIVE' ? 'bg-green-100 text-green-600 animate-pulse' : 'bg-blue-100 text-blue-600'}`}>
                                <Bus size={32} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800">Bus {trip.busNumber}</h1>
                                <div className="flex items-center gap-2">
                                    {trip.status === 'ACTIVE' ? (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                                            <Navigation size={12} className="fill-current" />
                                            Live Tracking
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <CheckCircle2 size={12} />
                                            Trip Completed
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <Activity size={18} className="text-blue-500 mb-2" />
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duration</p>
                                <p className="text-sm font-bold text-slate-800 truncate">{formatDuration(trip.durationMinutes)}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <Navigation size={18} className="text-orange-500 mb-2" />
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Max Speed</p>
                                <p className="text-sm font-bold text-slate-800">{trip.maxSpeed ? Math.round(trip.maxSpeed) : '--'} mph</p>
                            </div>
                        </div>

                        {/* Detailed Timeline */}
                        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {/* Start Point */}
                            <div className="relative pl-8">
                                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-4 border-green-500 z-10" />
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none mb-1">Trip Started</p>
                                <p className="text-sm font-bold text-slate-800">{formatDateTime(trip.startTime)}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                        <User size={14} className="text-slate-500" />
                                    </div>
                                    <span className="text-xs text-slate-600 font-medium">By {trip.driverName}</span>
                                </div>
                            </div>

                            {/* End Point */}
                            <div className="relative pl-8">
                                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-4 z-10 ${trip.status === 'ACTIVE' ? 'border-amber-400 animate-pulse' : 'border-red-500'}`} />
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none mb-1">
                                    {trip.status === 'ACTIVE' ? 'Current Status' : 'Trip Finished'}
                                </p>
                                <p className="text-sm font-bold text-slate-800">{formatDateTime(trip.endTime)}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-12 space-y-3">
                            {trip.status === 'ACTIVE' && (
                                <button
                                    onClick={handleEndTrip}
                                    disabled={actionLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    <StopCircle size={20} />
                                    {actionLoading ? 'Stopping...' : 'Force Stop Trip'}
                                </button>
                            )}
                            <button
                                onClick={handleDeleteTrip}
                                disabled={actionLoading}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                <Trash2 size={18} />
                                Delete Record
                            </button>
                        </div>

                        {trip.status === 'ACTIVE' && (
                            <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
                                <div className="flex gap-3">
                                    <Activity size={18} className="text-green-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-green-700 leading-relaxed font-medium">
                                        This trip is currently active. The position and path will auto-update every 10 seconds.
                                    </p>
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-center text-slate-400 mt-8">
                            Trip ID: {tripId}<br />
                            Last sync: {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>
                </div>

                {/* Main Map View */}
                <div className="flex-1 relative bg-slate-50">
                    {path.length > 0 ? (
                        <MapLibreMap
                            buses={trip.status === 'ACTIVE' ? [{
                                id: trip.busId,
                                busNumber: trip.busNumber,
                                latitude: path[path.length - 1][0],
                                longitude: path[path.length - 1][1],
                                speed: 0,
                                status: 'BUSY'
                            }] : []}
                            path={path}
                            followBus={trip.status === 'ACTIVE'}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                                <MapIcon size={40} className="text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">No Path Data</h3>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                This trip doesn't have any GPS coordinates recorded yet. This can happen if the driver just started or if location services are disabled.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default TripDetail;
