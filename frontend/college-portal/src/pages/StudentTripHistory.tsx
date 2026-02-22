import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Clock, MapPin, User, ChevronRight, X,
    ArrowLeft, Bus, Loader2, Map as MapIcon, History
} from 'lucide-react';
import { getStudentTripHistory, getStudentTripPath } from '../services/api';
import MapLibreMapComponent from '../components/MapLibreMapComponent';
import { decodePolyline } from '../utils/polyline';

interface Trip {
    _id: string;
    tripId: string;
    busId: string;
    busNumber: string;
    driverName: string;
    startTime: string;
    endTime: string | null;
    status: string;
    durationMinutes?: number;
}

const StudentTripHistory = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [pathModalOpen, setPathModalOpen] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [tripPath, setTripPath] = useState<[number, number][]>([]);

    const collegeId = localStorage.getItem('current_college_id');

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                setLoading(true);
                const response = await getStudentTripHistory();
                if (response.success) {
                    setTrips(response.data);
                }
            } catch (err: any) {
                console.error("Failed to fetch trip history", err);
                setError("Failed to load history. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        if (collegeId) fetchTrips();
    }, [collegeId]);

    const handleViewPath = async (trip: Trip) => {
        console.log("Viewing path for trip:", trip._id);
        setSelectedTrip(trip);
        setTripPath([]);
        setPathModalOpen(true);
        setActionLoading(true);
        try {
            const response = await getStudentTripPath(trip._id);
            if (response.success) {
                if (response.polyline) {
                    const decodedCoords = decodePolyline(response.polyline);
                    setTripPath(decodedCoords);
                } else if (Array.isArray(response.data)) {
                    // Ensure robust mapping of either { lat, lng } or { latitude, longitude } to avoid empty parses
                    const pathPoints = response.data
                        .map((p: any) => {
                            const lat = Number(p.lat ?? p.latitude);
                            const lng = Number(p.lng ?? p.longitude);
                            return [lat, lng];
                        })
                        .filter((coords: number[]) => Number.isFinite(coords[0]) && Number.isFinite(coords[1])) as [number, number][];

                    setTripPath(pathPoints);
                }
            }
        } catch (err) {
            console.error("Failed to fetch trip path", err);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-10">
            {/* Header */}
            <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-16 gap-4">
                        <button
                            onClick={() => navigate(`/${orgSlug}/student/dashboard`)}
                            className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600/20 p-2 rounded-lg">
                                <History size={20} className="text-blue-400" />
                            </div>
                            <h1 className="font-bold text-lg tracking-tight">Trip History</h1>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm mb-6">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-24 bg-slate-800/50 rounded-2xl animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : trips.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-dashed border-white/10">
                        <History size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-1">No trips recorded yet</h3>
                        <p className="text-slate-400">Past bus routes will appear here once trips are completed.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {trips.map((trip) => (
                            <motion.div
                                key={trip._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group bg-slate-800/50 backdrop-blur-md border border-white/5 hover:border-blue-500/30 rounded-2xl overflow-hidden transition-all"
                            >
                                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-700/50 w-12 h-12 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                            <Bus size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-white text-lg">{trip.busNumber}</h4>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${trip.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                    }`}>
                                                    {trip.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-400">
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <Calendar size={14} className="text-slate-500" />
                                                    {formatDate(trip.startTime)}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <Clock size={14} className="text-slate-500" />
                                                    {formatTime(trip.startTime)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight mb-0.5">Duration</p>
                                            <p className="text-sm font-bold text-white">{trip.durationMinutes || '--'} min</p>
                                        </div>
                                        <button
                                            onClick={() => handleViewPath(trip)}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
                                        >
                                            <MapIcon size={16} />
                                            <span>View Path</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* Path Modal */}
            <AnimatePresence>
                {pathModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setPathModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-800 border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                        >
                            {/* Modal Header */}
                            <div className="p-6 sm:p-8 flex items-center justify-between shrink-0 bg-slate-800/80 backdrop-blur-md border-b border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400">
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            Trip Path: {selectedTrip?.busNumber}
                                        </h3>
                                        <p className="text-sm text-slate-400 font-medium">
                                            {selectedTrip && formatDate(selectedTrip.startTime)} • {selectedTrip && formatTime(selectedTrip.startTime)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPathModalOpen(false)}
                                    className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-400 hover:text-white"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Map Content */}
                            <div className="flex-1 min-h-[400px] sm:min-h-[500px] relative">
                                {actionLoading ? (
                                    <div className="absolute inset-0 z-10 bg-slate-800/80 backdrop-blur-sm flex flex-col items-center justify-center">
                                        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                                        <p className="font-bold text-slate-300">Retrieving path points...</p>
                                    </div>
                                ) : tripPath.length === 0 ? (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-400 bg-slate-800/50">
                                        <MapIcon size={64} className="mb-4 opacity-20" />
                                        <p className="font-bold text-lg">No path data available for this trip.</p>
                                        <p className="text-sm opacity-60">The route might have been too short or data wasn't captured.</p>
                                    </div>
                                ) : (
                                    <MapLibreMapComponent
                                        buses={[]}
                                        focusedLocation={null}
                                        path={tripPath}
                                    />
                                )}
                            </div>

                            {/* Modal Footer (Stats) */}
                            {selectedTrip && tripPath.length > 0 && (
                                <div className="p-6 bg-slate-900/50 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4 px-8">
                                    <StatItem icon={<User size={16} />} label="Driver" value={selectedTrip.driverName || 'N/A'} />
                                    <StatItem icon={<Clock size={16} />} label="Started" value={formatTime(selectedTrip.startTime)} />
                                    <StatItem icon={<ChevronRight size={16} />} label="Duration" value={`${selectedTrip.durationMinutes || '--'}m`} />
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const StatItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
    <div className="flex items-center gap-3">
        <div className="bg-white/5 p-2 rounded-lg text-slate-400">
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
            <p className="text-sm font-bold text-white truncate max-w-[100px]">{value}</p>
        </div>
    </div>
);

export default StudentTripHistory;
