import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Mail, Phone, Edit, Trash2, X, AlertCircle, CheckCircle, Crown, UserCog } from 'lucide-react';
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
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Admin Management</h1>
                        <p className="text-slate-500 mt-1">Add or manage college administrators</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all"
                    >
                        <Plus size={20} />
                        Add New Admin
                    </motion.button>
                </div>

                {/* Simplified Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Admins</p>
                        <h3 className="text-2xl font-black text-slate-900">{admins.length}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Super Admins</p>
                        <h3 className="text-2xl font-black text-slate-900">{admins.filter(a => a.role === 'SUPER_ADMIN').length}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">College Admins</p>
                        <h3 className="text-2xl font-black text-slate-900">{admins.filter(a => a.role === 'COLLEGE_ADMIN').length}</h3>
                    </div>
                </div>

                {/* Alerts */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl mb-6 flex items-start gap-3"
                        >
                            <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                            <p className="flex-1 font-medium">{error}</p>
                            <button onClick={() => setError('')} className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"><X size={16} /></button>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-xl mb-6 flex items-start gap-3"
                        >
                            <CheckCircle className="flex-shrink-0 mt-0.5" size={20} />
                            <p className="flex-1 font-medium">{success}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Admins Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="relative">
                            <div className="w-12 h-12 border-4 border-blue-500/20 rounded-full"></div>
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                        </div>
                    </div>
                ) : admins.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm"
                    >
                        <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <UserCog size={40} className="text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No Administrators Yet</h3>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">Start by adding your first administrator to manage your organization's resources.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
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
                                className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                            >
                                {admin.role === 'SUPER_ADMIN' && (
                                    <div className="absolute -top-2 -right-2">
                                        <div className="p-2 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/30">
                                            <Crown size={14} className="text-white" />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm ${admin.role === 'SUPER_ADMIN'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {admin.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 text-lg truncate">{admin.name}</h3>
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 border ${admin.role === 'SUPER_ADMIN'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                            {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'College Admin'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                            <Mail size={14} className="group-hover:text-blue-500" />
                                        </div>
                                        <span className="text-sm truncate font-medium">{admin.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                            <Phone size={14} className="group-hover:text-blue-500" />
                                        </div>
                                        <span className="text-sm font-medium">{admin.phone || 'Not provided'}</span>
                                    </div>
                                </div>

                                <div className="mt-5 pt-5 border-t border-slate-100 flex gap-2">
                                    <button
                                        onClick={() => setEditAdmin(admin)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
                                    >
                                        <Edit size={14} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(admin.userId)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
                                    >
                                        <Trash2 size={14} />
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
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl p-8 w-full max-w-md border border-slate-200 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-2xl">
                                        <Plus size={24} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Add New Admin</h3>
                                        <p className="text-slate-500 text-sm">Create a new administrator account</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleCreate} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter full name"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="admin@college.edu"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Initial Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
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
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl p-8 w-full max-w-md border border-slate-200 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-2xl">
                                        <Edit size={24} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Edit Admin</h3>
                                        <p className="text-slate-500 text-sm">Update administrator details</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditAdmin(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleUpdate} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editAdmin.name}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, name: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={editAdmin.email}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, email: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={editAdmin.phone || ''}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, phone: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditAdmin(null)}
                                        className="flex-1 px-4 py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
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
