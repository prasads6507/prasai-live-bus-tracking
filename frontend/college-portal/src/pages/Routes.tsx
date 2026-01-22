import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Plus, Search, X, AlertCircle, CheckCircle, Edit2, Trash2 } from 'lucide-react';
import { getRoutes, createRoute, updateRoute, deleteRoute, validateSlug } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

const Routes = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newRoute, setNewRoute] = useState({
        routeName: '',
        startPoint: '',
        endPoint: '',
        stops: [] as any[]
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingRoute, setEditingRoute] = useState<any>(null);

    useEffect(() => {
        initializeAndFetchRoutes();
    }, [orgSlug]);

    const initializeAndFetchRoutes = async () => {
        try {
            // Ensure college context is set
            if (orgSlug) {
                const orgData = await validateSlug(orgSlug);
                localStorage.setItem('current_college_id', orgData.collegeId);
            }
            await fetchRoutes();
        } catch (error) {
            console.error("Failed to initialize:", error);
            setLoading(false);
        }
    };

    const fetchRoutes = async () => {
        try {
            const data = await getRoutes();
            setRoutes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch routes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRoute = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        try {
            if (isEditMode && editingRoute) {
                // Update existing route
                await updateRoute(editingRoute._id, newRoute);
                setSuccessMessage(`Route ${newRoute.routeName} updated successfully!`);
            } else {
                // Create new route
                await createRoute(newRoute);
                setSuccessMessage(`Route ${newRoute.routeName} created successfully!`);
            }

            setNewRoute({ routeName: '', startPoint: '', endPoint: '', stops: [] });
            setIsEditMode(false);
            setEditingRoute(null);
            fetchRoutes(); // Refresh list
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

    const handleEditRoute = (route: any) => {
        setEditingRoute(route);
        setNewRoute({
            routeName: route.routeName,
            startPoint: route.startPoint || '',
            endPoint: route.endPoint || '',
            stops: route.stops || []
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDeleteRoute = async (routeId: string, routeName: string) => {
        if (!confirm(`Are you sure you want to delete Route ${routeName}? This will also delete all associated stops.`)) return;

        try {
            await deleteRoute(routeId);
            fetchRoutes();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete route');
        }
    };

    const addStop = () => {
        setNewRoute({
            ...newRoute,
            stops: [...newRoute.stops, { stopName: '', latitude: '', longitude: '' }]
        });
    };

    const removeStop = (index: number) => {
        const updatedStops = newRoute.stops.filter((_, i) => i !== index);
        setNewRoute({ ...newRoute, stops: updatedStops });
    };

    const updateStop = (index: number, field: string, value: string) => {
        const updatedStops = [...newRoute.stops];
        updatedStops[index][field] = value;
        setNewRoute({ ...newRoute, stops: updatedStops });
    };

    const filteredRoutes = routes.filter(route =>
        route.routeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.startPoint?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.endPoint?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <Layout activeItem="routes">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout activeItem="routes">
            <div className="p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-800 mb-2">Routes</h1>
                        <p className="text-slate-500">Manage bus routes and stops</p>
                    </div>

                    {/* Search & Add Button */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by route name or location..."
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
                                setEditingRoute(null);
                                setNewRoute({ routeName: '', startPoint: '', endPoint: '', stops: [] });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all"
                        >
                            <Plus size={20} />
                            <span>Add New Route</span>
                        </motion.button>
                    </div>

                    {/* Routes Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Route Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Start → End</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stops</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRoutes.length > 0 ? (
                                        filteredRoutes.map((route) => (
                                            <tr key={route._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                                            <MapPin className="text-green-600" size={20} />
                                                        </div>
                                                        <span className="font-semibold text-slate-800">{route.routeName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {route.startPoint} → {route.endPoint}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                                        {route.stopsCount || 0} stops
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEditRoute(route)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit Route"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRoute(route._id, route.routeName)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Route"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                {searchQuery ? 'No routes found matching your search.' : 'No routes added yet. Click "Add New Route" to get started.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Route Modal */}
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
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {isEditMode ? 'Edit Route' : 'New Route'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            {formError && (
                                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r flex items-start gap-3">
                                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                                    <span className="text-sm">{formError}</span>
                                </div>
                            )}

                            {successMessage && (
                                <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-r flex items-start gap-3">
                                    <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                                    <span className="text-sm">{successMessage}</span>
                                </div>
                            )}

                            <form onSubmit={handleCreateRoute} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Route Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g., Route A - City Center"
                                        value={newRoute.routeName}
                                        onChange={(e) => setNewRoute({ ...newRoute, routeName: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Start Point</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g., Main Campus"
                                            value={newRoute.startPoint}
                                            onChange={(e) => setNewRoute({ ...newRoute, startPoint: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">End Point</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g., City Center"
                                            value={newRoute.endPoint}
                                            onChange={(e) => setNewRoute({ ...newRoute, endPoint: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Stops Section */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-semibold text-slate-700">Stops (Optional)</label>
                                        <button
                                            type="button"
                                            onClick={addStop}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                                        >
                                            <Plus size={16} />
                                            Add Stop
                                        </button>
                                    </div>

                                    {newRoute.stops.length > 0 && (
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {newRoute.stops.map((stop, index) => (
                                                <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 space-y-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Stop Name"
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                value={stop.stopName}
                                                                onChange={(e) => updateStop(index, 'stopName', e.target.value)}
                                                            />
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Latitude (optional)"
                                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                    value={stop.latitude}
                                                                    onChange={(e) => updateStop(index, 'latitude', e.target.value)}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Longitude (optional)"
                                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                    value={stop.longitude}
                                                                    onChange={(e) => updateStop(index, 'longitude', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeStop(index)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                    {formLoading ? 'Processing...' : (isEditMode ? 'Update Route' : 'Create Route')}
                                </motion.button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default Routes;
