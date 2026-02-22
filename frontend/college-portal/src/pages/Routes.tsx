import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Plus, Search, X, AlertCircle, CheckCircle, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { getRoutes, createRoute, updateRoute, deleteRoute, validateSlug, bulkCreateRoutes } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout';
import AddressAutocomplete, { reverseGeocode } from '../components/AddressAutocomplete';
import MapLibreMap from '../components/MapLibreMap';

const Routes = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newRoute, setNewRoute] = useState({
        routeName: '',
        stops: [] as any[]
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingRoute, setEditingRoute] = useState<any>(null);
    const [roadPath, setRoadPath] = useState<[number, number][]>([]);

    // Reorder Suggestion State
    const [showReorderUI, setShowReorderUI] = useState(false);
    const [suggestedStops, setSuggestedStops] = useState<any[]>([]);
    const [isReorderLoading, setIsReorderLoading] = useState(false);

    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadPreview, setUploadPreview] = useState<any[]>([]);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadResults, setUploadResults] = useState<any>(null); // For success/error messages

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

    // Auto-calculate road path when stops change
    useEffect(() => {
        const validStops = newRoute.stops.filter(s => s.latitude && s.longitude &&
            !isNaN(parseFloat(s.latitude)) && !isNaN(parseFloat(s.longitude)));

        if (validStops.length < 2) {
            setRoadPath([]);
            return;
        }

        const fetchRoadPath = async () => {
            try {
                const coords = validStops.map(s => `${s.longitude},${s.latitude}`).join(';');
                const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.code === 'Ok' && data.routes && data.routes[0]) {
                    setRoadPath(data.routes[0].geometry.coordinates);
                }
            } catch (err) {
                console.error("OSRM Route Error:", err);
            }
        };

        const timer = setTimeout(fetchRoadPath, 800); // Debounce
        return () => clearTimeout(timer);
    }, [newRoute.stops]);

    const checkRouteOrder = async () => {
        const validStops = newRoute.stops.filter(s => s.latitude && s.longitude &&
            !isNaN(parseFloat(s.latitude)) && !isNaN(parseFloat(s.longitude)));

        if (validStops.length < 3) return false; // Only suggest for 3+ stops

        setIsReorderLoading(true);
        try {
            const coords = validStops.map(s => `${s.longitude},${s.latitude}`).join(';');
            const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=any&destination=any&roundtrip=false`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.code === 'Ok' && data.waypoints) {
                const optimizedOrder = [...data.waypoints]
                    .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index);

                const newSuggestedStops = optimizedOrder.map((wp: any) => validStops[wp.location_index]);

                // Check if the order actually changed
                const orderChanged = newSuggestedStops.some((s, i) => s.stopName !== validStops[i].stopName);

                if (orderChanged) {
                    setSuggestedStops(newSuggestedStops);
                    setShowReorderUI(true);
                    setIsReorderLoading(false);
                    return true;
                }
            }
        } catch (err) {
            console.error("OSRM Trip Error:", err);
        }
        setIsReorderLoading(false);
        return false;
    };

    const handleCreateRoute = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // If we haven't checked reordering yet and there are enough stops
        if (!showReorderUI && newRoute.stops.length >= 3) {
            const hasSuggestion = await checkRouteOrder();
            if (hasSuggestion) return;
        }

        setFormLoading(true);
        setFormError('');

        try {
            const routeData = {
                ...newRoute,
                startPoint: '',
                endPoint: ''
            };

            if (isEditMode && editingRoute) {
                await updateRoute(editingRoute._id, routeData);
                setSuccessMessage(`Route ${newRoute.routeName} updated successfully!`);
            } else {
                await createRoute(routeData);
                setSuccessMessage(`Route ${newRoute.routeName} created successfully!`);
            }

            fetchRoutes();
            setShowReorderUI(false);

            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);

        } catch (err: any) {
            setFormError(err.response?.data?.message || err.message || 'Operation failed');
        } finally {
            setFormLoading(false);
        }
    };

    const resetModalState = () => {
        setIsModalOpen(false);
        setTimeout(() => {
            setNewRoute({ routeName: '', stops: [] });
            setIsEditMode(false);
            setEditingRoute(null);
            setSuccessMessage('');
            setFormError('');
            setShowReorderUI(false);
            setSuggestedStops([]);
        }, 300);
    };

    const handleEditRoute = (route: any) => {
        setEditingRoute(route);
        setNewRoute({
            routeName: route.routeName,
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
            stops: [...newRoute.stops, { stopName: '', latitude: '', longitude: '', pickupPlannedTime: '', dropoffPlannedTime: '', address: '' }]
        });
    };

    const removeStop = (index: number) => {
        const updatedStops = newRoute.stops.filter((_: any, i: number) => i !== index);
        setNewRoute({ ...newRoute, stops: updatedStops });
    };

    const moveStopUp = (index: number) => {
        if (index === 0) return;
        const stops = [...newRoute.stops];
        [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];
        setNewRoute({ ...newRoute, stops });
    };

    const moveStopDown = (index: number) => {
        if (index >= newRoute.stops.length - 1) return;
        const stops = [...newRoute.stops];
        [stops[index], stops[index + 1]] = [stops[index + 1], stops[index]];
        setNewRoute({ ...newRoute, stops });
    };

    const updateStop = async (index: number, field: string, value: string) => {
        const updatedStops = [...newRoute.stops];
        updatedStops[index][field] = value;

        if (field === 'latitude' || field === 'longitude') {
            const lat = parseFloat(field === 'latitude' ? value : updatedStops[index].latitude);
            const lng = parseFloat(field === 'longitude' ? value : updatedStops[index].longitude);

            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.1 && Math.abs(lng) > 0.1) {
                const address = await reverseGeocode(lat, lng);
                if (address && !address.includes('Point at')) {
                    updatedStops[index].address = address;
                }
            }
        }

        setNewRoute({ ...newRoute, stops: updatedStops });
    };

    const handleProcessFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const mappedData = jsonData.map((row: any) => ({
                routeName: row['Route Name'] || row['RouteName'] || row['routeName'] || '',
                stops: row['Stops'] || row['stops'] || ''
            })).filter(r => r.routeName);

            if (mappedData.length === 0) {
                alert('No valid routes found. Please check column headers (Route Name, Stops).');
                return;
            }

            setUploadPreview(mappedData);
            setUploadResults(null);
            e.target.value = '';
        } catch (err) {
            console.error(err);
            alert('Failed to parse file');
        }
    };

    const handleBulkUpload = async () => {
        if (uploadPreview.length === 0) return;

        setUploadLoading(true);
        setUploadResults(null);

        try {
            const result = await bulkCreateRoutes(uploadPreview);
            setUploadResults(result);
            setUploadPreview([]);
            await fetchRoutes();
        } catch (err: any) {
            setUploadResults({
                message: 'Upload failed',
                results: {
                    errors: [{ error: err.response?.data?.message || err.message }]
                }
            });
        } finally {
            setUploadLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [['Route Name', 'Stops']];
        const data = routes.length > 0
            ? routes.map(r => [
                r.routeName,
                Array.isArray(r.stops) ? r.stops.map((s: any) => s.stopName).join(', ') : ''
            ])
            : [
                ['Route 101', 'Stop A, Stop B, Stop C'],
                ['Route 202', 'Main St, High School, Library']
            ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);
        ws['!cols'] = [{ wch: 30 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Routes');
        XLSX.writeFile(wb, 'Routes_Template.xlsx');
    };

    const filteredRoutes = routes.filter(route =>
        route.routeName?.toLowerCase().includes(searchQuery.toLowerCase())
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
                            onClick={() => setIsUploadModalOpen(true)}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all"
                        >
                            <Upload size={20} />
                            <span>Upload Routes</span>
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                setIsEditMode(false);
                                setEditingRoute(null);
                                setNewRoute({ routeName: '', stops: [] });
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
                                            <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
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
                        onClick={(e) => {
                            if (e.target === e.currentTarget) resetModalState();
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl p-6 max-h-[95vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {showReorderUI ? 'Optimize Route Sequence' : (isEditMode ? 'Edit Route' : 'New Route')}
                                </h2>
                                <button onClick={resetModalState} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
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

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    {showReorderUI ? (
                                        <div className="space-y-6">
                                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                                                <h3 className="text-blue-800 font-bold flex items-center gap-2 mb-1">
                                                    <AlertCircle size={18} />
                                                    Optimization Available
                                                </h3>
                                                <p className="text-blue-700 text-sm">
                                                    We found a shorter sequence for these stops. Choose the order you prefer:
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* Current Order */}
                                                <div
                                                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition-all flex flex-col group"
                                                    onClick={() => { setShowReorderUI(false); handleCreateRoute(); }}
                                                >
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-xs font-bold text-slate-500 uppercase">Current</span>
                                                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">YOURS</span>
                                                    </div>
                                                    <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto pr-1">
                                                        {newRoute.stops.map((s, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                                                <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold">{i + 1}</div>
                                                                <span className="truncate">{s.stopName || 'Unnamed'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button className="mt-auto w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors">
                                                        Keep Original
                                                    </button>
                                                </div>

                                                {/* Optimized Order */}
                                                <div
                                                    className="bg-white border-2 border-green-200 rounded-xl p-4 cursor-pointer hover:border-green-500 transition-all flex flex-col group shadow-md"
                                                    onClick={() => { setNewRoute({ ...newRoute, stops: suggestedStops }); setShowReorderUI(false); }}
                                                >
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-xs font-bold text-green-700 uppercase">Optimized</span>
                                                        <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">BETTER</span>
                                                    </div>
                                                    <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto pr-1">
                                                        {suggestedStops.map((s, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs text-green-800">
                                                                <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px] font-bold">{i + 1}</div>
                                                                <span className="font-medium truncate">{s.stopName || 'Unnamed'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button className="mt-auto w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors">
                                                        Use Recommended
                                                    </button>
                                                </div>
                                            </div>

                                            <button onClick={() => setShowReorderUI(false)} className="w-full text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-tighter">
                                                Discard and go back to editing
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleCreateRoute} className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Route Name</label>
                                                <input
                                                    type="text" required
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-semibold"
                                                    value={newRoute.routeName}
                                                    onChange={(e) => setNewRoute({ ...newRoute, routeName: e.target.value })}
                                                    placeholder="e.g. City Center Route"
                                                />
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stops Sequence</h3>
                                                    <button type="button" onClick={addStop} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                                        <Plus size={14} /> Add Stop
                                                    </button>
                                                </div>

                                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {newRoute.stops.length === 0 ? (
                                                        <div className="py-12 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-300">
                                                            <MapPin size={32} strokeWidth={1.5} />
                                                            <p className="text-xs font-medium mt-2">No stops added yet</p>
                                                        </div>
                                                    ) : (
                                                        newRoute.stops.map((stop, index) => (
                                                            <div key={index} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex flex-col gap-1 items-center">
                                                                        <button type="button" onClick={() => moveStopUp(index)} className="text-slate-400 hover:text-blue-600 disabled:opacity-20" disabled={index === 0}>
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15" /></svg>
                                                                        </button>
                                                                        <span className="text-[10px] font-bold text-slate-400">{index + 1}</span>
                                                                        <button type="button" onClick={() => moveStopDown(index)} className="text-slate-400 hover:text-blue-600 disabled:opacity-20" disabled={index === newRoute.stops.length - 1}>
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type="text" placeholder="Stop Name"
                                                                        className="flex-grow px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
                                                                        value={stop.stopName}
                                                                        onChange={(e) => updateStop(index, 'stopName', e.target.value)}
                                                                    />
                                                                    <button type="button" onClick={() => removeStop(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                                                        <X size={18} />
                                                                    </button>
                                                                </div>
                                                                <AddressAutocomplete
                                                                    initialAddress={stop.address || ''}
                                                                    biasLat={index > 0 ? parseFloat(newRoute.stops[index - 1].latitude) : 17.3850}
                                                                    biasLon={index > 0 ? parseFloat(newRoute.stops[index - 1].longitude) : 78.4867}
                                                                    onSelect={(data) => {
                                                                        const ns = [...newRoute.stops];
                                                                        ns[index] = { ...ns[index], address: data.address, latitude: data.lat.toString(), longitude: data.lng.toString() };
                                                                        setNewRoute({ ...newRoute, stops: ns });
                                                                    }}
                                                                    className="w-full mt-2"
                                                                />
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            <motion.button
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                type="submit"
                                                disabled={formLoading || isReorderLoading}
                                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${formLoading || isReorderLoading ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                                    }`}
                                            >
                                                {formLoading ? 'Saving...' : (isReorderLoading ? 'Checking path...' : (isEditMode ? 'Update Route' : 'Create Route'))}
                                            </motion.button>
                                        </form>
                                    )}
                                </div>

                                <div className="h-[500px] lg:h-full lg:min-h-[600px] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 sticky top-0 z-0">
                                    <MapLibreMap
                                        buses={[]}
                                        stopMarkers={newRoute.stops.map(s => ({
                                            lat: parseFloat(s.latitude) || 0,
                                            lng: parseFloat(s.longitude) || 0,
                                            name: s.stopName || 'Stop'
                                        }))}
                                        routePreviewPath={roadPath.length > 0 ? roadPath : newRoute.stops
                                            .filter(s => s.latitude && s.longitude)
                                            .map(s => [parseFloat(s.longitude), parseFloat(s.latitude)])
                                        }
                                        showStopCircles={true}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Routes Modal */}
            <AnimatePresence>
                {isUploadModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setIsUploadModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 min-h-[500px] flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between mb-6 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Batch Upload Routes</h2>
                                    <p className="text-slate-500 text-sm">Upload Excel with "Route Name" and "Stops" (comma separated)</p>
                                </div>
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                {uploadResults && uploadResults.results ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in">
                                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                            <CheckCircle size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800">{uploadResults.message}</h3>
                                        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-left max-w-md w-full max-h-60 overflow-y-auto">
                                            {uploadResults.results.errors?.length > 0 && (
                                                <div className="mb-4 text-red-600">
                                                    <p className="font-bold mb-1">Errors ({uploadResults.results.errors.length}):</p>
                                                    <ul className="text-sm list-disc pl-4">
                                                        {uploadResults.results.errors.map((e: any, i: number) => (
                                                            <li key={i}>{e.error} (Route: {e.route?.routeName})</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {uploadResults.results.success?.length > 0 && (
                                                <div className="text-green-600">
                                                    <p className="font-bold mb-1">Success ({uploadResults.results.success.length}):</p>
                                                    <p className="text-sm">Routes created/updated successfully.</p>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setUploadResults(null);
                                                setIsUploadModalOpen(false);
                                            }}
                                            className="mt-6 bg-slate-800 text-white px-6 py-2 rounded-lg"
                                        >
                                            Close
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {!uploadPreview.length && (
                                            <div className="flex-1 flex flex-col items-center justify-center">
                                                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer w-full max-w-xl group"
                                                    onClick={() => document.getElementById('route-file-input')?.click()}
                                                >
                                                    <input
                                                        id="route-file-input"
                                                        type="file"
                                                        accept=".xlsx,.xls,.csv"
                                                        className="hidden"
                                                        onChange={handleProcessFile}
                                                    />
                                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-blue-500">
                                                        <Upload size={32} />
                                                    </div>
                                                    <p className="font-bold text-slate-700 text-lg">Click to Upload Excel File</p>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadTemplate();
                                                        }}
                                                        className="mt-6 flex items-center gap-2 text-blue-600 font-bold hover:underline"
                                                    >
                                                        <Download size={16} /> Download Template
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {uploadPreview.length > 0 && (
                                            <div className="flex-1 flex flex-col min-h-0">
                                                <div className="flex items-center justify-between mb-4">
                                                    <p className="text-slate-600 font-medium">Found <span className="font-bold text-slate-900">{uploadPreview.length}</span> routes</p>
                                                    <button
                                                        onClick={() => setUploadPreview([])}
                                                        className="text-red-500 text-sm hover:underline"
                                                    >
                                                        Clear & Upload New
                                                    </button>
                                                </div>
                                                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                                            <tr>
                                                                <th className="p-3 font-semibold text-slate-700">Route Name</th>
                                                                <th className="p-3 font-semibold text-slate-700">Stops Preview</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {uploadPreview.map((row, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50">
                                                                    <td className="p-3 font-medium text-slate-800">{row.routeName}</td>
                                                                    <td className="p-3 text-slate-600 truncate max-w-md" title={row.stops}>
                                                                        {row.stops}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <button
                                                    onClick={handleBulkUpload}
                                                    disabled={uploadLoading}
                                                    className="mt-6 w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 disabled:opacity-50"
                                                >
                                                    {uploadLoading ? 'Processing...' : `Import ${uploadPreview.length} Routes`}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default Routes;
