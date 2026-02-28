import { useState, useEffect } from 'react';
import { User, Plus, Search, Mail, Phone, Lock, X, AlertCircle, CheckCircle, Edit2, Trash2, ToggleRight, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { getDrivers, createDriver, updateDriver, deleteDriver, bulkCreateDrivers } from '../services/api';
// XLSX will be lazy-loaded on demand to optimize bundle size
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

const Drivers = () => {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newDriver, setNewDriver] = useState({
        name: '',
        email: '',
        phone: '',
        password: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingDriver, setEditingDriver] = useState<any>(null);

    // Bulk Upload State
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkPreview, setBulkPreview] = useState<any[]>([]);
    const [selectedBulkIndices, setSelectedBulkIndices] = useState<number[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkError, setBulkError] = useState('');
    const [bulkSuccess, setBulkSuccess] = useState('');

    useEffect(() => {
        fetchDrivers();
    }, []);

    const fetchDrivers = async () => {
        try {
            setError('');
            const data = await getDrivers();
            setDrivers(Array.isArray(data) ? data : []);
        } catch (error: any) {
            console.error("Failed to fetch drivers:", error);
            setError(error.response?.data?.message || error.message || 'Failed to load drivers');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        try {
            if (isEditMode && editingDriver) {
                // Update existing driver
                await updateDriver(editingDriver._id, newDriver);
                setSuccessMessage(`Driver ${newDriver.name} updated successfully!`);
            } else {
                // Create new driver
                await createDriver(newDriver);
                setSuccessMessage(`Driver ${newDriver.name} created successfully!`);
            }

            setNewDriver({ name: '', email: '', phone: '', password: '' });
            setIsEditMode(false);
            setEditingDriver(null);
            fetchDrivers(); // Refresh list
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

    const handleEditDriver = (driver: any) => {
        setEditingDriver(driver);
        setNewDriver({
            name: driver.name,
            email: driver.email,
            phone: driver.phone || '',
            password: '' // Don't populate password for security
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDeleteDriver = async (driverId: string, driverName: string) => {
        if (!confirm(`Are you sure you want to delete ${driverName}?`)) return;

        try {
            await deleteDriver(driverId);
            fetchDrivers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete driver');
        }
    };

    const handleToggleStatus = async (driver: any) => {
        const newStatus = driver.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

        try {
            await updateDriver(driver._id, { status: newStatus });
            fetchDrivers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    const downloadDriverTemplate = async () => {
        // Dynamically import XLSX only when needed
        const XLSX = await import('xlsx');
        const headers = [['Name', 'Email', 'Phone']];

        // Use existing drivers to populate the template
        const data = drivers.length > 0
            ? drivers.map(d => [d.name, d.email, d.phone || ''])
            : [['John Driver', 'driver1@example.com', '9876543210']]; // Fallback example if no drivers

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);

        // Set column widths
        ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }];

        XLSX.utils.book_append_sheet(wb, ws, 'Drivers');
        XLSX.writeFile(wb, 'Drivers_Template.xlsx');
    };

    const handleProcessFile = async (file: File) => {
        try {
            // Dynamically import XLSX only when needed
            const XLSX = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            // Map keys loosely
            const mappedData = jsonData.map((row: any) => ({
                name: row['Name'] || row['name'] || '',
                email: row['Email'] || row['email'] || '',
                phone: row['Phone'] || row['phone'] || ''
            })).filter(r => r.name && r.email && r.phone); // Basic filter

            if (mappedData.length === 0) {
                setBulkError('No valid data found in file. Please check column headers (Name, Email, Phone).');
                return;
            }

            setBulkPreview(mappedData);
            setSelectedBulkIndices(mappedData.map((_, i) => i)); // Select all by default
            setBulkError('');
        } catch (err) {
            setBulkError('Failed to parse Excel file');
            console.error(err);
        }
    };

    const handleBulkUpload = async () => {
        if (selectedBulkIndices.length === 0) return;

        setBulkLoading(true);
        setBulkError('');

        try {
            const driversToUpload = selectedBulkIndices.map(i => bulkPreview[i]);
            const response = await bulkCreateDrivers(driversToUpload);

            setBulkSuccess(response.message || 'Drivers imported successfully!');
            fetchDrivers();

            // Reset after delay or close (handled in success view)
        } catch (err: any) {
            console.error(err);
            setBulkError(err.response?.data?.message || 'Bulk upload failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const filteredDrivers = drivers.filter(driver =>
        String(driver.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(driver.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout activeItem="drivers">
            <div className="p-6">
                <div className="max-w-7xl mx-auto w-full h-full flex flex-col">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                    <User size={24} />
                                </div>
                                Driver Management
                            </h1>
                            <p className="text-slate-500 mt-1 ml-12">Manage fleet drivers and access credentials</p>
                        </div>
                        <div className="flex gap-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsBulkModalOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-colors"
                            >
                                <Upload size={20} />
                                Bulk Upload
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-colors"
                            >
                                <Plus size={20} />
                                Add New Driver
                            </motion.button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-center gap-4">
                        <Search className="text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
                        />
                    </div>

                    {/* Drivers List */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm"
                            >
                                <div className="flex items-center">
                                    <AlertCircle className="text-red-500 mr-2" />
                                    <p className="text-red-700 font-medium">{error}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex-1 overflow-auto bg-white rounded-2xl shadow-sm border border-slate-200">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : filteredDrivers.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                    <tr>
                                        <th className="p-5 font-semibold text-slate-600">Name</th>
                                        <th className="p-5 font-semibold text-slate-600">Contact</th>
                                        <th className="p-5 font-semibold text-slate-600">Role</th>
                                        <th className="p-5 font-semibold text-slate-600">Status</th>
                                        <th className="p-5 font-semibold text-slate-600 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDrivers.map((driver) => (
                                        <tr key={driver._id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                                        {(driver.name || 'D').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{driver.name || 'Unknown Driver'}</p>
                                                        <p className="text-xs text-slate-400">ID: {driver._id ? driver._id.slice(-6) : 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <Mail size={14} className="text-slate-400" />
                                                        {driver.email}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <Phone size={14} className="text-slate-400" />
                                                        {driver.phone || 'N/A'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                                    DRIVER
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${driver.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {driver.status || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditDriver(driver)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Edit Driver"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(driver)}
                                                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                                        title="Toggle Status"
                                                    >
                                                        <ToggleRight size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDriver(driver._id, driver.name)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Delete Driver"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-12">
                                <User size={48} className="text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-700">No Drivers Found</h3>
                                <p className="text-slate-500 max-w-sm mt-2">
                                    Get started by adding your first driver to the system.
                                </p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="mt-6 text-blue-600 font-bold hover:underline"
                                >
                                    Add Driver Now
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Driver Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {isEditMode ? 'Edit Driver' : 'New Driver Account'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            {successMessage ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800">Success!</h3>
                                    <p className="text-slate-500 mt-2">{successMessage}</p>
                                </div>
                            ) : (
                                <form onSubmit={handleCreateDriver} className="space-y-5">
                                    {/* Name */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                required
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                                placeholder="John Doe"
                                                value={newDriver.name}
                                                onChange={e => setNewDriver({ ...newDriver, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Contact Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="email"
                                                    required
                                                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                                                    placeholder="email@Example.com"
                                                    value={newDriver.email}
                                                    onChange={e => setNewDriver({ ...newDriver, email: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">Phone</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="tel"
                                                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                                                    placeholder="123-456-7890"
                                                    value={newDriver.phone}
                                                    onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">
                                            Password {isEditMode && <span className="text-slate-400 font-normal">(leave blank to keep current)</span>}
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="password"
                                                required={!isEditMode}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                                placeholder="••••••••"
                                                value={newDriver.password}
                                                onChange={e => setNewDriver({ ...newDriver, password: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Error & Submit */}
                                    {formError && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                            {formError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-200 transition-all ${formLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5'
                                            }`}
                                    >
                                        {formLoading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Driver' : 'Create Driver Account')}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Bulk Upload Modal */}
            <AnimatePresence>
                {isBulkModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsBulkModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                        <FileSpreadsheet className="text-emerald-600" />
                                        Bulk Upload Drivers
                                    </h2>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Upload Excel sheet to auto-create accounts (Password = Phone Number)
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsBulkModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            {bulkSuccess ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-300">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800">Upload Successful!</h3>
                                    <p className="text-slate-500 mt-2">{bulkSuccess}</p>
                                    <button
                                        onClick={() => {
                                            setBulkSuccess('');
                                            setIsBulkModalOpen(false);
                                            fetchDrivers();
                                        }}
                                        className="mt-6 bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col min-h-0">
                                    {/* Upload Area */}
                                    {!bulkPreview.length && (
                                        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                                            onClick={() => document.getElementById('bulk-file-input')?.click()}
                                        >
                                            <input
                                                id="bulk-file-input"
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleProcessFile(file);
                                                }}
                                            />
                                            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-blue-500">
                                                <Upload size={32} />
                                            </div>
                                            <p className="font-bold text-slate-700 text-lg">Click to Upload Excel File</p>
                                            <p className="text-slate-400 text-sm mt-1">Supported formats: .xlsx, .xls, .csv</p>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    downloadDriverTemplate();
                                                }}
                                                className="mt-6 flex items-center gap-2 text-blue-600 font-bold hover:underline"
                                            >
                                                <Download size={16} /> Download Template
                                            </button>
                                        </div>
                                    )}

                                    {/* Preview Table */}
                                    {bulkPreview.length > 0 && (
                                        <div className="flex-1 flex flex-col min-h-0">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-slate-600 font-medium">
                                                    Found <span className="text-slate-900 font-bold">{bulkPreview.length}</span> records
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        setBulkPreview([]);
                                                        setBulkError('');
                                                    }}
                                                    className="text-red-500 text-sm hover:underline"
                                                >
                                                    Clear & Upload New
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                                        <tr>
                                                            <th className="p-3 w-10">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-300"
                                                                    checked={selectedBulkIndices.length === bulkPreview.length}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedBulkIndices(bulkPreview.map((_, i) => i));
                                                                        } else {
                                                                            setSelectedBulkIndices([]);
                                                                        }
                                                                    }}
                                                                />
                                                            </th>
                                                            <th className="p-3 font-semibold text-slate-700">Name</th>
                                                            <th className="p-3 font-semibold text-slate-700">Email</th>
                                                            <th className="p-3 font-semibold text-slate-700">Phone</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {bulkPreview.map((row, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                <td className="p-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-slate-300"
                                                                        checked={selectedBulkIndices.includes(idx)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedBulkIndices(prev => [...prev, idx]);
                                                                            } else {
                                                                                setSelectedBulkIndices(prev => prev.filter(i => i !== idx));
                                                                            }
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="p-3 text-slate-800">{row.name}</td>
                                                                <td className="p-3 text-slate-600">{row.email}</td>
                                                                <td className="p-3 text-slate-600">{row.phone}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="mt-6 shrink-0 space-y-3">
                                        {bulkError && (
                                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                                {bulkError}
                                            </div>
                                        )}
                                        {bulkPreview.length > 0 && (
                                            <button
                                                onClick={handleBulkUpload}
                                                disabled={bulkLoading || selectedBulkIndices.length === 0}
                                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 ${bulkLoading || selectedBulkIndices.length === 0
                                                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                                    }`}
                                            >
                                                {bulkLoading ? 'Processing...' : `Upload ${selectedBulkIndices.length} Drivers`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default Drivers;
