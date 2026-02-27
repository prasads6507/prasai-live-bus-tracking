import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    RefreshCcw,
    Calendar as CalendarIcon,
    Users,
    CheckCircle2,
    Bus as BusIcon,
    ArrowUpCircle,
    ArrowDownCircle,
    ClipboardList,
    UserCheck,
    UserX,
    Clock,
    ChevronRight,
} from 'lucide-react';
import Layout from '../components/Layout';
import { api, getAttendance, getBuses, validateSlug } from '../services/api';
import { format, parseISO } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
    id: string;
    studentId: string;
    studentName: string;
    busId: string;
    busNumber: string;
    direction: string;
    status: 'picked_up' | 'dropped_off' | 'not_boarded' | 'not_dropped';
    pickedUpAt: string | null;
    droppedOffAt: string | null;
    createdAt: string | null;
    tripId: string;
}

interface AttendanceGroup {
    key: string;
    busId: string;
    busNumber: string;
    direction: string;
    date: string;
    records: AttendanceRecord[];
    presentCount: number;
    absentCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isPresent = (status: string) => status === 'picked_up' || status === 'dropped_off';

const formatTime = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    try {
        return format(parseISO(iso), 'hh:mm a');
    } catch {
        return '—';
    }
};

const directionLabel = (dir: string) =>
    dir === 'dropoff' ? 'Drop Off' : 'Pickup';

// ─── Component ───────────────────────────────────────────────────────────────

const BusAttendance = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();

    // Data state
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [buses, setBuses] = useState<any[]>([]);

    // Filter state
    const [filters, setFilters] = useState({
        busId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        direction: '',
    });

    // View state: 'list' = grouped summary, 'detail' = drill-down
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedGroup, setSelectedGroup] = useState<AttendanceGroup | null>(null);

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchData = async () => {
        setLoading(true);
        try {
            const [attendanceRes, busesData] = await Promise.all([
                getAttendance({ busId: filters.busId, date: filters.date }),
                getBuses(),
            ]);
            setAttendance(attendanceRes.data || []);
            setBuses(Array.isArray(busesData) ? busesData : (busesData?.data || []));
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const initializeAndFetch = async () => {
        try {
            setLoading(true);
            if (orgSlug) {
                const orgData = await validateSlug(orgSlug);
                if (orgData?.collegeId) {
                    localStorage.setItem('current_college_id', orgData.collegeId);
                    api.defaults.headers.common['x-tenant-id'] = orgData.collegeId;
                }
            }
            await fetchData();
        } catch (error) {
            console.error('Failed to initialize:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        initializeAndFetch();
    }, [orgSlug]);

    // Re-fetch when date or busId filter changes (not direction — that filters client-side)
    useEffect(() => {
        fetchData();
    }, [filters.date, filters.busId]);

    // ── Computed groups ────────────────────────────────────────────────────────

    const getBusNumber = (busId: string): string => {
        const bus = buses.find((b: any) => (b._id || b.id) === busId);
        return bus?.busNumber || bus?.number || busId;
    };

    const groups = useMemo<AttendanceGroup[]>(() => {
        // Apply direction filter client-side
        const filtered = filters.direction
            ? attendance.filter((a) => a.direction === filters.direction)
            : attendance;

        // Group by busId + direction
        const map = new Map<string, AttendanceRecord[]>();
        filtered.forEach((record) => {
            const key = `${record.busId}__${record.direction}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(record);
        });

        // Build group objects
        const result: AttendanceGroup[] = [];
        map.forEach((records, key) => {
            const [busId, direction] = key.split('__');
            const busNumber = records[0]?.busNumber || getBusNumber(busId);
            const presentCount = records.filter((r) => isPresent(r.status)).length;
            const absentCount = records.filter((r) => !isPresent(r.status)).length;
            result.push({
                key,
                busId,
                busNumber,
                direction,
                date: filters.date,
                records,
                presentCount,
                absentCount,
            });
        });

        // Sort: buses numerically, pickup before dropoff
        result.sort((a, b) => {
            const busComp = a.busNumber.localeCompare(b.busNumber, undefined, { numeric: true });
            if (busComp !== 0) return busComp;
            if (a.direction === 'pickup' && b.direction !== 'pickup') return -1;
            if (a.direction !== 'pickup' && b.direction === 'pickup') return 1;
            return 0;
        });

        return result;
    }, [attendance, filters.direction, buses]);

    // Top-level stats (across all filtered groups)
    const totalStats = useMemo(() => {
        const allRecords = groups.flatMap((g) => g.records);
        return {
            total: allRecords.length,
            present: allRecords.filter((r) => isPresent(r.status)).length,
            absent: allRecords.filter((r) => !isPresent(r.status)).length,
        };
    }, [groups]);

    // ── Navigation ─────────────────────────────────────────────────────────────

    const openDetail = (group: AttendanceGroup) => {
        setSelectedGroup(group);
        setView('detail');
    };

    const backToList = () => {
        setView('list');
        setSelectedGroup(null);
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Layout activeItem="attendance">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={view === 'detail' ? backToList : () => navigate(-1)}
                            className="p-2 hover:bg-white rounded-xl border border-slate-200 transition-colors shadow-sm"
                        >
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <div>
                            {view === 'list' ? (
                                <>
                                    <h1 className="text-2xl font-bold text-slate-900">Bus Attendance</h1>
                                    <p className="text-slate-500 text-sm">Student pickup &amp; drop-off summary</p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-2xl font-bold text-slate-900">
                                        Bus {selectedGroup?.busNumber} — {directionLabel(selectedGroup?.direction || '')}
                                    </h1>
                                    <p className="text-slate-500 text-sm">
                                        {selectedGroup ? format(parseISO(selectedGroup.date), 'dd MMM yyyy') : ''}
                                    </p>
                                </>
                            )}
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

                <AnimatePresence mode="wait">

                    {/* ═══════════════════════ LIST VIEW ═══════════════════════ */}
                    {view === 'list' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            {/* ── Filters ── */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">

                                {/* Bus Number */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                                        <BusIcon size={14} /> Bus Number
                                    </label>
                                    <select
                                        value={filters.busId}
                                        onChange={(e) => setFilters({ ...filters, busId: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">All Buses</option>
                                        {buses.map((bus: any) => (
                                            <option key={bus._id || bus.id} value={bus._id || bus.id}>
                                                Bus {bus.busNumber || bus.number}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                                        <CalendarIcon size={14} /> Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.date}
                                        onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>

                                {/* Direction */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                                        Direction
                                    </label>
                                    <select
                                        value={filters.direction}
                                        onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">All Directions</option>
                                        <option value="pickup">⬆ Pickup Only</option>
                                        <option value="dropoff">⬇ Drop Off Only</option>
                                    </select>
                                </div>
                            </div>

                            {/* ── Global Stats ── */}
                            <div className="grid grid-cols-3 gap-4">
                                <StatCard
                                    title="Total Records"
                                    value={totalStats.total}
                                    icon={<Users className="text-blue-500" />}
                                    color="bg-blue-50"
                                />
                                <StatCard
                                    title="Present"
                                    value={totalStats.present}
                                    icon={<UserCheck className="text-emerald-500" />}
                                    color="bg-emerald-50"
                                />
                                <StatCard
                                    title="Absent"
                                    value={totalStats.absent}
                                    icon={<UserX className="text-rose-500" />}
                                    color="bg-rose-50"
                                />
                            </div>

                            {/* ── Groups List ── */}
                            <div className="space-y-3">
                                {loading ? (
                                    Array(3).fill(0).map((_, i) => (
                                        <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-100 p-5 h-24" />
                                    ))
                                ) : groups.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-16 flex flex-col items-center gap-3 text-slate-400">
                                        <ClipboardList size={48} />
                                        <p className="text-base">No attendance records found for this selection.</p>
                                        <p className="text-sm text-slate-300">Try changing the date or direction filter.</p>
                                    </div>
                                ) : (
                                    groups.map((group, i) => (
                                        <GroupCard
                                            key={group.key}
                                            group={group}
                                            index={i}
                                            onClick={() => openDetail(group)}
                                        />
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ═══════════════════════ DETAIL VIEW ═══════════════════════ */}
                    {view === 'detail' && selectedGroup && (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            {/* Detail Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <StatCard
                                    title="Total"
                                    value={selectedGroup.records.length}
                                    icon={<Users className="text-blue-500" />}
                                    color="bg-blue-50"
                                />
                                <StatCard
                                    title={selectedGroup.direction === 'pickup' ? 'Picked Up' : 'Dropped Off'}
                                    value={selectedGroup.presentCount}
                                    icon={selectedGroup.direction === 'pickup'
                                        ? <ArrowUpCircle className="text-emerald-500" />
                                        : <ArrowDownCircle className="text-violet-500" />}
                                    color={selectedGroup.direction === 'pickup' ? 'bg-emerald-50' : 'bg-violet-50'}
                                />
                                <StatCard
                                    title="Absent"
                                    value={selectedGroup.absentCount}
                                    icon={<UserX className="text-rose-500" />}
                                    color="bg-rose-50"
                                />
                            </div>

                            {/* Detail Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                                                    {selectedGroup.direction === 'pickup' ? 'Picked Up At' : 'Dropped Off At'}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedGroup.records.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-16 text-center text-slate-400">
                                                        No records in this group.
                                                    </td>
                                                </tr>
                                            ) : (
                                                // Sort: present first, then absent
                                                [...selectedGroup.records]
                                                    .sort((a, b) => {
                                                        const ap = isPresent(a.status) ? 0 : 1;
                                                        const bp = isPresent(b.status) ? 0 : 1;
                                                        if (ap !== bp) return ap - bp;
                                                        return (a.studentName || '').localeCompare(b.studentName || '');
                                                    })
                                                    .map((record, i) => (
                                                        <motion.tr
                                                            key={record.id}
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.03 }}
                                                            className="hover:bg-slate-50 transition-colors"
                                                        >
                                                            {/* Student */}
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 text-sm flex-shrink-0">
                                                                        {(record.studentName || '?')[0].toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-slate-900">
                                                                            {record.studentName || 'Unknown Student'}
                                                                        </div>
                                                                        <div className="text-xs text-slate-400">
                                                                            {(record.studentId || '').split('-').slice(-1)[0]}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Status */}
                                                            <td className="px-6 py-4">
                                                                <StatusBadge status={record.status} />
                                                            </td>

                                                            {/* Time */}
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                                                                    {isPresent(record.status) ? (
                                                                        <>
                                                                            <Clock size={13} className="text-slate-400" />
                                                                            {selectedGroup.direction === 'pickup'
                                                                                ? formatTime(record.pickedUpAt)
                                                                                : formatTime(record.droppedOffAt)}
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-slate-300">—</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </Layout>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const GroupCard = ({
    group,
    index,
    onClick,
}: {
    group: AttendanceGroup;
    index: number;
    onClick: () => void;
}) => (
    <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06 }}
        onClick={onClick}
        className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all p-5 flex items-center gap-4 group"
    >
        {/* Bus icon */}
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BusIcon size={22} className="text-blue-600" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-slate-900">Bus {group.busNumber}</span>
                <DirectionBadge direction={group.direction} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-slate-500">
                    <CalendarIcon size={12} />
                    {format(parseISO(group.date), 'dd MMM yyyy')}
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                    <UserCheck size={13} />
                    {group.presentCount} Present
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-rose-500">
                    <UserX size={13} />
                    {group.absentCount} Absent
                </span>
            </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
    </motion.button>
);

const DirectionBadge = ({ direction }: { direction: string }) => (
    direction === 'dropoff' ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-bold border border-violet-100">
            <ArrowDownCircle size={11} />
            Drop Off
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
            <ArrowUpCircle size={11} />
            Pickup
        </span>
    )
);

const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
        case 'picked_up':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Picked Up
                </span>
            );
        case 'dropped_off':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-bold border border-violet-100">
                    <CheckCircle2 size={11} />
                    Dropped Off
                </span>
            );
        case 'not_boarded':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-100">
                    Not Boarded
                </span>
            );
        case 'not_dropped':
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-xs font-bold border border-slate-100">
                    Not Dropped Off
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-bold border border-slate-100">
                    Pending
                </span>
            );
    }
};

const StatCard = ({
    title,
    value,
    icon,
    color,
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
            <p className="text-slate-500 text-xs font-medium">{title}</p>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-3 ${color} rounded-xl shadow-inner`}>{icon}</div>
    </div>
);

export default BusAttendance;
