import { useState, useEffect } from 'react';
import { User, Plus, Search, Mail, Phone, Lock, X, AlertCircle, CheckCircle, Edit2, Trash2, ToggleRight } from 'lucide-react';
import { getDrivers, createDriver, updateDriver, deleteDriver } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

const Drivers = () => {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        fetchDrivers();
    }, []);

    const fetchDrivers = async () => {
        try {
            const data = await getDrivers();
            setDrivers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch drivers:", error);
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

    const filteredDrivers = drivers.filter(driver =>
        driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driver.email.toLowerCase().includes(searchQuery.toLowerCase())
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
                                                        {driver.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{driver.name}</p>
                                                        <p className="text-xs text-slate-400">ID: {driver._id.slice(-6)}</p>
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
        </Layout>
    );
};

export default Drivers;
