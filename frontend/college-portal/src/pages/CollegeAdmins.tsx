import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCog, Plus, Edit, Trash2, X, Check, AlertTriangle, Shield, Mail, Phone, Crown } from 'lucide-react';
import Layout from '../components/Layout';
import { getCollegeAdmins, createCollegeAdmin, updateCollegeAdmin, deleteCollegeAdmin } from '../services/api';

interface Admin {
    userId: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    collegeId: string;
}

const CollegeAdmins = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const navigate = useNavigate();
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const collegeId = localStorage.getItem('current_college_id');

    // Check if user can access this page
    useEffect(() => {
        if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'OWNER') {
            navigate(`/${orgSlug}/dashboard`);
        }
    }, [user, orgSlug, navigate]);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: ''
    });

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            const data = await getCollegeAdmins();
            setAdmins(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load admins');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await createCollegeAdmin({ ...formData, collegeId });
            setSuccess('Admin created successfully!');
            setShowAddModal(false);
            setFormData({ name: '', email: '', phone: '', password: '' });
            fetchAdmins();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create admin');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editAdmin) return;
        try {
            await updateCollegeAdmin(editAdmin.userId, {
                name: editAdmin.name,
                email: editAdmin.email,
                phone: editAdmin.phone
            });
            setSuccess('Admin updated successfully!');
            setEditAdmin(null);
            fetchAdmins();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update admin');
        }
    };

    const handleDelete = async (userId: string) => {
        if (!window.confirm('Are you sure you want to delete this admin?')) return;
        try {
            await deleteCollegeAdmin(userId);
            setSuccess('Admin deleted successfully!');
            fetchAdmins();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to delete admin');
        }
    };

    return (
        <Layout activeItem="admins">
            <div className="space-y-6">
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8"
                >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTJoMnYyaC0yem0tNC0yaC0ydjJoMnYtMnptMCAydjRoLTJ2LTRoMnptLTYgMGgydjJoLTJ2LTJ6bTItMmgtMnYyaDJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-300/20 rounded-full blur-2xl -ml-24 -mb-24"></div>

                    <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/20">
                                <Shield className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">Admin Management</h1>
                                <p className="text-white/70 font-medium">Add or manage college administrators</p>
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-2xl font-bold shadow-xl shadow-purple-900/30 hover:shadow-2xl transition-all"
                        >
                            <Plus size={20} />
                            Add New Admin
                        </motion.button>
                    </div>

                    {/* Stats */}
                    <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                            <p className="text-white/60 text-sm font-medium">Total Admins</p>
                            <p className="text-3xl font-black text-white">{admins.length}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                            <p className="text-white/60 text-sm font-medium">Super Admins</p>
                            <p className="text-3xl font-black text-white">{admins.filter(a => a.role === 'SUPER_ADMIN').length}</p>
                        </div>
                        <div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                            <p className="text-white/60 text-sm font-medium">College Admins</p>
                            <p className="text-3xl font-black text-white">{admins.filter(a => a.role === 'COLLEGE_ADMIN').length}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Alerts */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 text-red-400 px-5 py-4 rounded-2xl flex items-center gap-3 backdrop-blur-md"
                        >
                            <div className="p-2 bg-red-500/20 rounded-xl">
                                <AlertTriangle size={18} />
                            </div>
                            <span className="flex-1 font-medium">{error}</span>
                            <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"><X size={16} /></button>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 px-5 py-4 rounded-2xl flex items-center gap-3 backdrop-blur-md"
                        >
                            <div className="p-2 bg-green-500/20 rounded-xl">
                                <Check size={18} />
                            </div>
                            <span className="font-medium">{success}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Admins Grid */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-purple-500/30 rounded-full"></div>
                            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                        </div>
                    </div>
                ) : admins.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/5 rounded-3xl p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <UserCog size={40} className="text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Administrators Yet</h3>
                        <p className="text-slate-400 mb-6">Add your first administrator to get started</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                        >
                            Add First Admin
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {admins.map((admin, index) => (
                            <motion.div
                                key={admin.userId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10"
                            >
                                {admin.role === 'SUPER_ADMIN' && (
                                    <div className="absolute -top-2 -right-2">
                                        <div className="p-2 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/30">
                                            <Crown size={14} className="text-white" />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg ${admin.role === 'SUPER_ADMIN'
                                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30'
                                            : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30'
                                        }`}>
                                        {admin.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white text-lg truncate">{admin.name}</h3>
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${admin.role === 'SUPER_ADMIN'
                                                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/20'
                                                : 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/20'
                                            }`}>
                                            {admin.role === 'SUPER_ADMIN' ? '👑 Super Admin' : '🔑 College Admin'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <div className="p-2 bg-slate-700/50 rounded-lg">
                                            <Mail size={14} />
                                        </div>
                                        <span className="text-sm truncate">{admin.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <div className="p-2 bg-slate-700/50 rounded-lg">
                                            <Phone size={14} />
                                        </div>
                                        <span className="text-sm">{admin.phone || 'Not provided'}</span>
                                    </div>
                                </div>

                                <div className="mt-5 pt-5 border-t border-white/5 flex gap-2">
                                    <button
                                        onClick={() => setEditAdmin(admin)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 rounded-xl font-semibold hover:bg-blue-500/20 transition-colors"
                                    >
                                        <Edit size={16} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(admin.userId)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl font-semibold hover:bg-red-500/20 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        Delete
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
                        onClick={() => setShowAddModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
                                        <Plus size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Add New Admin</h3>
                                        <p className="text-slate-400 text-sm">Create a new administrator account</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleCreate} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter full name"
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="admin@college.edu"
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Initial Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-3.5 bg-slate-700/50 text-slate-300 rounded-xl font-semibold hover:bg-slate-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                                    >
                                        Create Admin
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {editAdmin && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
                        onClick={() => setEditAdmin(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl">
                                        <Edit size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Edit Admin</h3>
                                        <p className="text-slate-400 text-sm">Update administrator details</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditAdmin(null)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleUpdate} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editAdmin.name}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, name: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={editAdmin.email}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, email: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={editAdmin.phone || ''}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, phone: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditAdmin(null)}
                                        className="flex-1 px-4 py-3.5 bg-slate-700/50 text-slate-300 rounded-xl font-semibold hover:bg-slate-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default CollegeAdmins;
