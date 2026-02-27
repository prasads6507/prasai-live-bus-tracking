import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    ChevronLeft, 
    RefreshCcw, 
    Calendar as CalendarIcon, 
    Users, 
    CheckCircle2, 
    Bus as BusIcon,
    ClipboardList
} from 'lucide-react';
import Layout from '../components/Layout';
import { getAttendance, getBuses, getTripHistory, validateSlug } from '../services/api';
import { format } from 'date-fns';

const BusAttendance = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [buses, setBuses] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]);
    
    const [filters, setFilters] = useState({
        busId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        tripId: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [attendanceRes, busesData, tripsRes] = await Promise.all([
                getAttendance(filters),
                getBuses(),
                getTripHistory()
            ]);
            
            setAttendance(attendanceRes.data || []);
            setBuses(busesData || []);
            // Filter trips by date and bus for the dropdown if needed
            setTrips(tripsRes.data || []);
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const initializeAndFetch = async () => {
        try {
            if (orgSlug) {
                const orgData = await validateSlug(orgSlug);
                localStorage.setItem('current_college_id', orgData.collegeId);
            }
            await fetchData();
        } catch (error) {
            console.error("Failed to initialize:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        initializeAndFetch();
    }, [orgSlug, filters.date, filters.busId, filters.tripId]);

    const stats = {
        total: attendance.length,
        onBus: attendance.filter(a => a.status === 'picked_up').length,
        completed: attendance.filter(a => a.status === 'dropped_off').length
    };

    return (
        <Layout activeItem="attendance">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-white rounded-xl border border-slate-200 transition-colors shadow-sm"
                        >
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Bus Attendance</h1>
                            <p className="text-slate-500 text-sm">Track student pickup and drop-off status</p>
                        </div>
                    </div>
                    <button 
                        onClick={fetchData}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-lg shadow-blue-200"
                    >
                        <RefreshCcw size={18} />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                            <BusIcon size={14} /> Bus Number
                        </label>
                        <select 
                            value={filters.busId}
                            onChange={(e) => setFilters({...filters, busId: e.target.value})}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                            <option value="">All Buses</option>
                            {buses.map(bus => (
                                <option key={bus._id} value={bus._id}>
                                    Bus {bus.busNumber || bus.number}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                            <CalendarIcon size={14} /> Date
                        </label>
                        <input 
                            type="date"
                            value={filters.date}
                            onChange={(e) => setFilters({...filters, date: e.target.value})}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                            <ClipboardList size={14} /> Trip
                        </label>
                        <select 
                            value={filters.tripId}
                            onChange={(e) => setFilters({...filters, tripId: e.target.value})}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                            <option value="">All Trips</option>
                            {trips
                                .filter(t => !filters.busId || t.busId === filters.busId)
                                .map(trip => (
                                <option key={trip._id} value={trip._id}>
                                    {trip.driverName} - {format(new Date(trip.startTime), 'p')}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <StatCard 
                        title="Total Students" 
                        value={stats.total} 
                        icon={<Users className="text-blue-500" />} 
                        color="bg-blue-50"
                    />
                    <StatCard 
                        title="Currently On Bus" 
                        value={stats.onBus} 
                        icon={<BusIcon className="text-emerald-500" />} 
                        color="bg-emerald-50"
                    />
                    <StatCard 
                        title="Completed Trips" 
                        value={stats.completed} 
                        icon={<CheckCircle2 className="text-violet-500" />} 
                        color="bg-violet-50"
                    />
                </div>

                {/* Attendance Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Bus</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Picked Up</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Dropped Off</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : attendance.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <ClipboardList size={48} />
                                                <p>No attendance records found for this selection.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    attendance.map((record, i) => (
                                        <motion.tr 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            key={record.id} 
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-900">{record.studentName}</div>
                                                <div className="text-xs text-slate-500">ID: {record.studentId.split('-').pop()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                                        <BusIcon size={14} />
                                                    </div>
                                                    <span className="font-medium">Bus {buses.find(b => b._id === record.busId)?.busNumber || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.status === 'picked_up' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                        On Bus
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                                                        <CheckCircle2 size={12} />
                                                        Completed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                {format(new Date(record.pickedUpAt), 'p')}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                {record.droppedOffAt ? format(new Date(record.droppedOffAt), 'p') : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

const StatCard = ({ title, value, icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
            <p className="text-slate-500 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-4 ${color} rounded-2xl shadow-inner`}>
            {icon}
        </div>
    </div>
);

export default BusAttendance;
