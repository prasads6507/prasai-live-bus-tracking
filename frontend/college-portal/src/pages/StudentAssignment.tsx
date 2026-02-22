import { useState, useEffect } from 'react';
import { getStudentAssignments, assignStudentsToStop, getRoutes } from '../services/api';
import { Search, Bus, MapPin, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudentRow {
    _id: string;
    name: string;
    studentId: string;
    assignedBusId: string | null;
    assignedRouteId: string | null;
    assignedStopId: string | null;
}

interface RouteData {
    _id: string;
    routeName: string;
    stops: { stopId: string; stopName: string }[];
}

export default function StudentAssignment() {
    const navigate = useNavigate();
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [search, setSearch] = useState('');
    const [selectedRouteId, setSelectedRouteId] = useState('');
    const [selectedStopId, setSelectedStopId] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [studRes, routeRes] = await Promise.all([
                getStudentAssignments(),
                getRoutes()
            ]);
            setStudents(studRes.data || []);
            setRoutes(routeRes.data || routeRes || []);
        } catch (err) {
            console.error('Failed to load data:', err);
        }
        setLoading(false);
    };

    const filtered = students.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(search.toLowerCase())
    );

    const toggleStudent = (id: string) => {
        const next = new Set(selectedStudents);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedStudents(next);
    };

    const selectAll = () => {
        if (selectedStudents.size === filtered.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(filtered.map(s => s._id)));
        }
    };

    const handleAssign = async () => {
        if (!selectedRouteId || selectedStudents.size === 0) return;
        setSaving(true);
        try {
            const assignments = Array.from(selectedStudents).map(studentId => ({
                studentId,
                busId: '',
                routeId: selectedRouteId,
                stopId: selectedStopId,
            }));
            await assignStudentsToStop(assignments);
            await loadData();
            setSelectedStudents(new Set());
            alert(`Assigned ${assignments.length} students successfully!`);
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Assignment failed');
        }
        setSaving(false);
    };

    const selectedRoute = routes.find(r => r._id === selectedRouteId);
    const routeStops = selectedRoute?.stops || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition">
                        <ArrowLeft size={22} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Student Route Assignment</h1>
                        <p className="text-slate-500 text-sm">Assign students to bus routes and stops</p>
                    </div>
                </div>

                {/* Assignment Controls */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Assign To</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Route</label>
                            <select value={selectedRouteId} onChange={e => { setSelectedRouteId(e.target.value); setSelectedStopId(''); }}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none">
                                <option value="">Select Route</option>
                                {routes.map(r => <option key={r._id} value={r._id}>{r.routeName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Stop</label>
                            <select value={selectedStopId} onChange={e => setSelectedStopId(e.target.value)}
                                disabled={!selectedRouteId}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none disabled:opacity-50">
                                <option value="">Select Stop (optional)</option>
                                {routeStops.map(s => <option key={s.stopId} value={s.stopId}>{s.stopName}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button onClick={handleAssign}
                                disabled={saving || !selectedRouteId || selectedStudents.size === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                <Save size={16} />
                                {saving ? 'Assigning...' : `Assign ${selectedStudents.size} Student${selectedStudents.size !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search & Select All */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-grow relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none" />
                    </div>
                    <button onClick={selectAll}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition whitespace-nowrap">
                        {selectedStudents.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                {/* Student Table */}
                {loading ? (
                    <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 w-10"><input type="checkbox" checked={selectedStudents.size === filtered.length && filtered.length > 0} onChange={selectAll} className="accent-blue-600" /></th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Student ID</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600 flex items-center gap-1"><Bus size={14} /> Route</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-600"><span className="flex items-center gap-1"><MapPin size={14} /> Stop</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => {
                                    const route = routes.find(r => r._id === s.assignedRouteId);
                                    const stop = route?.stops?.find((st: any) => st.stopId === s.assignedStopId);
                                    return (
                                        <tr key={s._id} className={`border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition ${selectedStudents.has(s._id) ? 'bg-blue-50' : ''}`}
                                            onClick={() => toggleStudent(s._id)}>
                                            <td className="px-4 py-3"><input type="checkbox" checked={selectedStudents.has(s._id)} onChange={() => toggleStudent(s._id)} className="accent-blue-600" /></td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                                            <td className="px-4 py-3 text-slate-500">{s.studentId}</td>
                                            <td className="px-4 py-3">
                                                {route ? (
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{route.routeName}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Not assigned</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {stop ? (
                                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{stop.stopName}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">No students found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="text-xs text-slate-400 text-center mt-4">{students.length} total students • {selectedStudents.size} selected</p>
            </div>
        </div>
    );
}
