import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Plus, Search, X, AlertCircle, CheckCircle, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { getRoutes, createRoute, updateRoute, deleteRoute, validateSlug, bulkCreateRoutes } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
// XLSX will be lazy-loaded on demand to reduce bundle size
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

    // Optimization State
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
    const [optimizedStops, setOptimizedStops] = useState<any[]>([]);
    const [optimizing, setOptimizing] = useState(false);

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

    const checkRouteOptimization = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const validStops = newRoute.stops.filter(s => s.latitude && s.longitude && !isNaN(parseFloat(s.latitude)) && !isNaN(parseFloat(s.longitude)));

        // Only optimize if we have 3 or more valid stops (Start, End, and at least 1 intermediate)
        if (validStops.length >= 3) {
            setOptimizing(true);
            try {
                // Using OSRM Trip API (TSP solver)
                // Source: first stop, Destination: last stop
                const coords = validStops.map(s => `${s.longitude},${s.latitude}`).join(';');
                // roundtrip=false to not return to start, source=first, destination=last
                const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=false&source=first&destination=last&steps=false`;

                const res = await fetch(url);
                const data = await res.json();

                if (data.code === 'Ok' && data.waypoints) {
                    // Extract the new order from waypoint indices
                    // Sort the valid stops based on waypoint indices to get the optimized order
                    const sortedStops = [...validStops].map((stop, originalIndex) => {
                        const wp = data.waypoints.find((w: any) => w.original_index === originalIndex);
                        return { stop, newIndex: wp.waypoint_index };
                    }).sort((a, b) => a.newIndex - b.newIndex).map(x => x.stop);

                    // Check if the order actually changed (excluding minor coordinate diffs, just looking at names/refs)
                    let orderChanged = false;
                    for (let i = 0; i < validStops.length; i++) {
                        if (validStops[i].stopName !== sortedStops[i].stopName) {
                            orderChanged = true;
                            break;
                        }
                    }

                    if (orderChanged) {
                        setOptimizedStops(sortedStops);
                        setIsOptimizationModalOpen(true);
                        setOptimizing(false);
                        return; // Halt regular submission
                    }
                }
            } catch (err) {
                console.error("Failed to check route optimization", err);
            }
            setOptimizing(false);
        }

        // If no optimization needed or failed, submit normally
        submitRouteInfo(newRoute.stops);
    };

    const submitRouteInfo = async (stopsToSubmit: any[]) => {
        setFormLoading(true);
        setFormError('');

        try {
            // Sanitize stops: ensure coordinates, radius, and order are numbers
            const sanitizedStops = stopsToSubmit.map((stop, index) => ({
                ...stop,
                latitude: parseFloat(stop.latitude) || 0,
                longitude: parseFloat(stop.longitude) || 0,
                radiusM: parseInt(stop.radiusM?.toString() || '100', 10),
                order: index
            }));

            const routeData = {
                ...newRoute,
                stops: sanitizedStops,
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
            setIsOptimizationModalOpen(false);

            // Hide success message after a bit, but DO NOT close the modal
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);

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

    const closeModal = () => {
        setIsModalOpen(false);
        setNewRoute({ routeName: '', stops: [] });
        setIsEditMode(false);
        setEditingRoute(null);
        setSuccessMessage('');
        setFormError('');
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

        // Auto-reverse geocode if coordinates are manually entered
        if (field === 'latitude' || field === 'longitude') {
            const lat = parseFloat(field === 'latitude' ? value : updatedStops[index].latitude);
            const lng = parseFloat(field === 'longitude' ? value : updatedStops[index].longitude);

            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.1 && Math.abs(lng) > 0.1) {
                // Debounce or just fire? Nominatim has rate limits, but for manual typing it's okay-ish with some checks
                // For now, let's just do it
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
            // Dynamically import XLSX only when needed
            const XLSX = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            // Map loosely: 'Route Name' or 'routeName', 'Stops' or 'stops'
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

            // Clear input so same file can be selected again if needed
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
            setUploadPreview([]); // Clear preview on success (or keep it? better clear for result view)
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

    const handleDownloadTemplate = async () => {
        // Dynamically import XLSX only when needed
        const XLSX = await import('xlsx');
        const headers = [['Route Name', 'Stops']];

        // Use existing routes to populate template
        // Stops should be comma separated string
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

        // Col widths
        ws['!cols'] = [{ wch: 30 }, { wch: 50 }];

        XLSX.utils.book_append_sheet(wb, ws, 'Routes');
        XLSX.writeFile(wb, 'Routes_Template.xlsx');
    };

    const filteredRoutes = routes.filter(route =>
        String(route.routeName || '').toLowerCase().includes(searchQuery.toLowerCase())
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
                            // Only close if exactly the background was clicked
                            if (e.target === e.currentTarget) {
                                closeModal();
                            }
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl p-6 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {isEditMode ? 'Edit Route' : 'New Route'}
                                </h2>
                                <button
                                    onClick={closeModal}
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

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <form onSubmit={checkRouteOptimization} className="space-y-4">
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
                                                    <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                                        <div className="flex items-start gap-2 w-full">
                                                            <div className="flex flex-col items-center gap-0.5 mt-1">
                                                                <button type="button" onClick={() => moveStopUp(index)} className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30" disabled={index === 0}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                                                                </button>
                                                                <span className="text-xs font-bold text-slate-400 w-4 text-center">{index + 1}</span>
                                                                <button type="button" onClick={() => moveStopDown(index)} className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30" disabled={index === newRoute.stops.length - 1}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                                                                </button>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Stop Name"
                                                                className="flex-grow px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                value={stop.stopName}
                                                                onChange={(e) => updateStop(index, 'stopName', e.target.value)}
                                                            />
                                                            <input
                                                                type="number"
                                                                placeholder="Lat"
                                                                className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                value={stop.latitude || ''}
                                                                onChange={(e) => updateStop(index, 'latitude', e.target.value)}
                                                                step="any"
                                                            />
                                                            <input
                                                                type="number"
                                                                placeholder="Lng"
                                                                className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                value={stop.longitude || ''}
                                                                onChange={(e) => updateStop(index, 'longitude', e.target.value)}
                                                                step="any"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeStop(index)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                        <div className="flex gap-2 pl-8 items-start relative z-[100]">
                                                            <div className="flex-grow z-50">
                                                                <AddressAutocomplete
                                                                    initialAddress={stop.address || ''}
                                                                    biasLat={index > 0 ? parseFloat(newRoute.stops[index - 1].latitude) : 17.3850}
                                                                    biasLon={index > 0 ? parseFloat(newRoute.stops[index - 1].longitude) : 78.4867}
                                                                    onSelect={(data) => {
                                                                        const newStops = [...newRoute.stops];
                                                                        newStops[index].address = data.address;
                                                                        newStops[index].latitude = data.lat.toString();
                                                                        newStops[index].longitude = data.lng.toString();
                                                                        setNewRoute({ ...newRoute, stops: newStops });
                                                                    }}
                                                                    className="w-full bg-white border border-slate-200 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="Pickup (HH:MM)"
                                                                className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                value={stop.pickupPlannedTime || ''}
                                                                onChange={(e) => updateStop(index, 'pickupPlannedTime', e.target.value)}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Dropoff (HH:MM)"
                                                                className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                                                value={stop.dropoffPlannedTime || ''}
                                                                onChange={(e) => updateStop(index, 'dropoffPlannedTime', e.target.value)}
                                                            />
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
                                        disabled={formLoading || optimizing || newRoute.stops.length < 2 || !newRoute.routeName}
                                        className={`w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${formLoading || optimizing || newRoute.stops.length < 2 || !newRoute.routeName
                                            ? 'bg-slate-400 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
                                            }`}
                                    >
                                        {formLoading || optimizing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                                            <>
                                                <CheckCircle size={18} />
                                                {isEditMode ? 'Update Route' : 'Create Route'}
                                            </>
                                        )}
                                    </motion.button>
                                </form>

                                {/* Map Visualization */}
                                <div className="h-[400px] lg:h-[600px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative z-0">
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

            {/* Optimization Suggestion Modal */}
            <AnimatePresence>
                {isOptimizationModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-amber-50 relative shrink-0">
                                <button
                                    onClick={() => setIsOptimizationModalOpen(false)}
                                    className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="bg-orange-500/20 p-3 rounded-full">
                                        <AlertCircle size={28} className="text-orange-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Better Route Order Suggested</h2>
                                        <p className="text-sm text-slate-600 font-medium">We found a shorter, more optimal path connecting your stops. Would you like to use the suggested order?</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row p-6 gap-6 bg-slate-50 overflow-y-auto">
                                {/* Left: Current Order */}
                                <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 flex flex-col">
                                    <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider sticky top-0 bg-white z-20 py-1">Your Current Order</h3>
                                    <div className="space-y-4 relative flex-1">
                                        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-slate-200" />
                                        {newRoute.stops.filter(s => s.latitude && s.longitude).map((stop, idx) => (
                                            <div key={`curr-${idx}`} className="flex items-start gap-4 relative z-10 bg-white">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{stop.stopName || `Stop ${idx + 1}`}</p>
                                                    <p className="text-[10px] text-slate-500 truncate mt-0.5" title={stop.address}>{stop.address}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => { e.preventDefault(); submitRouteInfo(newRoute.stops); }}
                                        disabled={formLoading}
                                        className="mt-6 w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
                                    >
                                        Keep Current Order
                                    </button>
                                </div>

                                {/* Right: Optimized Order */}
                                <div className="flex-1 bg-white p-4 rounded-2xl border-2 border-orange-500 shadow-sm shadow-orange-500/20 relative flex flex-col">
                                    <div className="absolute -top-3 right-4 bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm z-30">
                                        Recommended
                                    </div>
                                    <h3 className="text-sm font-bold text-orange-600 mb-4 uppercase tracking-wider sticky top-0 bg-white z-20 py-1">Suggested Order</h3>
                                    <div className="space-y-4 relative flex-1">
                                        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-orange-200" />
                                        {optimizedStops.map((stop, idx) => (
                                            <div key={`opt-${idx}`} className="flex items-start gap-4 relative z-10 bg-white">
                                                <div className="w-6 h-6 rounded-full bg-orange-50 border border-orange-300 flex items-center justify-center text-[10px] font-bold text-orange-600 shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{stop.stopName || `Stop ${idx + 1}`}</p>
                                                    <p className="text-[10px] text-slate-500 truncate mt-0.5" title={stop.address}>{stop.address}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setNewRoute((prev: any) => ({ ...prev, stops: optimizedStops }));
                                            submitRouteInfo(optimizedStops);
                                        }}
                                        disabled={formLoading}
                                        className="mt-6 w-full py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                                    >
                                        {formLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                                            <>
                                                <CheckCircle size={18} />
                                                Use Suggested Order
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
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
                                {/* Success/Result State */}
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
                                        {/* Initial State / Upload Area */}
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

                                        {/* Preview Table */}
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
