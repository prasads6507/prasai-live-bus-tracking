import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, Plus, Search, Trash2, Edit2, Wrench, X, CheckCircle, Settings, Users } from 'lucide-react';
import { getBuses, createBus, updateBus, deleteBus, validateSlug, getDrivers, getRoutes } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

const Buses = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [buses, setBuses] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newBus, setNewBus] = useState({
        busNumber: '',
        plateNumber: '',
        assignedDriverId: '',
        assignedRouteId: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingBus, setEditingBus] = useState<any>(null);

    useEffect(() => {
        initializeAndFetchBuses();
    }, [orgSlug]);

    const initializeAndFetchBuses = async () => {
        try {
            if (orgSlug) {
                const orgData = await validateSlug(orgSlug);
                localStorage.setItem('current_college_id', orgData.collegeId);
            }
            await Promise.all([fetchBuses(), fetchDrivers(), fetchRoutes()]);
        } catch (error) {
            console.error("Failed to initialize:", error);
            setLoading(false);
        }
    };

    const fetchDrivers = async () => {
        try {
            const data = await getDrivers();
            setDrivers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch drivers:", error);
        }
    };

    const fetchRoutes = async () => {
        try {
            const data = await getRoutes();
            setRoutes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch routes:", error);
        }
    };

    const fetchBuses = async () => {
        try {
            const data = await getBuses();
            setBuses(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch buses:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBus = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        try {
            if (isEditMode && editingBus) {
                await updateBus(editingBus._id, newBus);
                setSuccessMessage(`Bus ${newBus.busNumber} updated successfully!`);
            } else {
                await createBus(newBus);
                setSuccessMessage(`Bus ${newBus.busNumber} created successfully!`);
            }

            setNewBus({ busNumber: '', plateNumber: '', assignedDriverId: '', assignedRouteId: '' });
            setIsEditMode(false);
            setEditingBus(null);
            fetchBuses();
            setTimeout(() => {
                setSuccessMessage('');
                setIsModalOpen(false);
            }, 1500);
        } catch (err: any) {
            setFormError(err.response?.data?.message || err.message || 'Operation failed');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditBus = (bus: any) => {
        setEditingBus(bus);
        setNewBus({
            busNumber: bus.busNumber,
            plateNumber: bus.plateNumber || '',
            assignedDriverId: bus.assignedDriverId || '',
            assignedRouteId: bus.assignedRouteId || ''
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDeleteBus = async (busId: string, busNumber: string) => {
        if (!confirm(`Are you sure you want to delete Bus ${busNumber}?`)) return;

        try {
            await deleteBus(busId);
            fetchBuses();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete bus');
        }
    };

    const toggleMaintenance = async (bus: any) => {
        const newStatus = bus.status === 'MAINTENANCE' ? 'ACTIVE' : 'MAINTENANCE';
        try {
            const updatedBus = await updateBus(bus._id, { status: newStatus });
            setBuses(buses.map(b => b._id === bus._id ? updatedBus : b));
            setSuccessMessage(`Bus marked as ${newStatus.toLowerCase()}`);
        } catch (err: any) {
            console.error('Update Status Error:', err);
            setFormError(err.message || 'Failed to update status');
        }
    };

    const handleAssignSubstitute = async (busId: string, substituteBusId: string) => {
        try {
            const updatedBus = await updateBus(busId, {
                substituteBusId: substituteBusId || null,
                trackingMode: substituteBusId ? 'substitute' : 'gps'
            });
            setBuses(buses.map(b => b._id === busId ? updatedBus : b));
            setSuccessMessage(substituteBusId ? 'Substitute bus assigned' : 'Substitute bus removed');
        } catch (err: any) {
            console.error('Assign Substitute Error:', err);
            setFormError(err.message || 'Failed to assign substitute');
        }
    };

    // ── NEW: Navigate to the bus-students assignment page ──
    const handleAddStudents = (bus: any) => {
        navigate(`/${orgSlug}/buses/${bus._id}/students`);
    };

    const filteredBuses = buses.filter(bus =>
        bus.busNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bus.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <Layout activeItem="buses">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout activeItem="buses">
            <div className="p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Buses</h1>
                        <p className="text-slate-500">Manage your fleet of buses</p>
                    </div>

                    {/* Global messages */}
                    <AnimatePresence>
                        {successMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl"
                            >
                                <CheckCircle size={18} />
                                {successMessage}
                            </motion.div>
                        )}
                        {formError && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl"
                            >
                                <X size={18} />
                                {formError}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Search & Add Button */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by bus number or plate..."
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                setIsEditMode(false);
                                setEditingBus(null);
                                setNewBus({ busNumber: '', plateNumber: '', assignedDriverId: '', assignedRouteId: '' });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all"
                        >
                            <Plus size={20} />
                            <span>Add New Bus</span>
                        </motion.button>
                    </div>

                    {/* Buses Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Bus Number</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plate Number</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned Driver</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Route</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredBuses.length > 0 ? (
                                        filteredBuses.map((bus) => (
                                            <tr key={bus._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <Bus className="text-blue-600" size={20} />
                                                        </div>
                                                        <span className="font-semibold text-slate-800">{bus.busNumber}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">{bus.plateNumber || 'N/A'}</td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {bus.assignedDriverId
                                                        ? drivers.find(d => d._id === bus.assignedDriverId)?.name || 'Unassigned'
                                                        : 'Unassigned'
                                                    }
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {bus.assignedRouteId
                                                        ? routes.find(r => r._id === bus.assignedRouteId)?.routeName || 'No Route'
                                                        : 'No Route'
                                                    }
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${bus.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {bus.status || 'ACTIVE'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 flex-wrap">

                                                        {/* ── NEW: Add Students Button ── */}
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleAddStudents(bus)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                                                            title="Assign Students to this Bus"
                                                        >
                                                            <Users size={14} />
                                                            Add Students
                                                        </motion.button>

                                                        <button
                                                            onClick={() => toggleMaintenance(bus)}
                                                            className={`p-2 rounded-lg transition-colors ${bus.status === 'MAINTENANCE'
                                                                ? 'text-green-600 hover:bg-green-50'
                                                                : 'text-orange-600 hover:bg-orange-50'
                                                                }`}
                                                            title={bus.status === 'MAINTENANCE' ? "Set Active" : "Set Maintenance"}
                                                        >
                                                            <Wrench size={18} />
                                                        </button>

                                                        {/* Substitute Bus Dropdown */}
                                                        {bus.status === 'MAINTENANCE' && (
                                                            <div className="relative group">
                                                                <select
                                                                    className="appearance-none bg-orange-50 text-orange-700 text-xs py-1 pl-2 pr-6 rounded border border-orange-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                                                                    value={bus.substituteBusId || ''}
                                                                    onChange={(e) => handleAssignSubstitute(bus._id, e.target.value)}
                                                                >
                                                                    <option value="">No Sub</option>
                                                                    {buses.filter(b => b._id !== bus._id && b.status === 'ACTIVE').map(b => (
                                                                        <option key={b._id} value={b._id}>{b.busNumber}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                                    <Settings size={10} className="text-orange-400" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={() => handleEditBus(bus)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit Bus"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBus(bus._id, bus.busNumber)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Bus"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                {searchQuery ? 'No buses found matching your search.' : 'No buses added yet. Click "Add New Bus" to get started.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Bus Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {isEditMode ? 'Edit Bus' : 'Add New Bus'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            {successMessage && (
                                <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                                    <CheckCircle size={16} />
                                    {successMessage}
                                </div>
                            )}
                            {formError && (
                                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    {formError}
                                </div>
                            )}

                            <form onSubmit={handleCreateBus} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Bus Number *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g., BUS-01"
                                        value={newBus.busNumber}
                                        onChange={(e) => setNewBus({ ...newBus, busNumber: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Plate Number *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g., ABC-1234"
                                        value={newBus.plateNumber}
                                        onChange={(e) => setNewBus({ ...newBus, plateNumber: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Assign Driver</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        value={newBus.assignedDriverId}
                                        onChange={(e) => setNewBus({ ...newBus, assignedDriverId: e.target.value })}
                                    >
                                        <option value="">-- Select Driver (Optional) --</option>
                                        {drivers.map((driver) => (
                                            <option key={driver._id} value={driver._id}>
                                                {driver.name} ({driver.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Assign Route</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        value={newBus.assignedRouteId}
                                        onChange={(e) => setNewBus({ ...newBus, assignedRouteId: e.target.value })}
                                    >
                                        <option value="">-- Select Route (Optional) --</option>
                                        {routes.map((route) => (
                                            <option key={route._id} value={route._id}>
                                                {route.routeName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={formLoading}
                                    className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${formLoading
                                        ? 'bg-slate-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
                                        }`}
                                >
                                    {formLoading ? 'Processing...' : (isEditMode ? 'Update Bus' : 'Create Bus Account')}
                                </motion.button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default Buses;
