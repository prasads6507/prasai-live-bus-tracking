import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCog, Plus, Edit, Trash2, X, Check, AlertTriangle, Shield, Phone, Crown } from 'lucide-react';
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
                    className="relative overflow-hidden rounded-[32px] bg-white p-8 shadow-sm border border-slate-100"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-50 rounded-full blur-2xl -ml-24 -mb-24"></div>

                    <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                                <Shield className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Admin Management</h1>
                                <p className="text-slate-500 font-medium ml-0.5 mt-1">Manage organization administrators and permissions</p>
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddModal(true)}
                            className="btn-premium btn-primary-gradient flex items-center gap-2 px-8 py-4 rounded-[20px]"
                        >
                            <Plus size={20} />
                            <span>Add New Admin</span>
                        </motion.button>
                    </div>

                    {/* Stats */}
                    <div className="relative mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total</p>
                            <p className="text-3xl font-black text-slate-900">{admins.length}</p>
                        </div>
                        <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100">
                            <p className="text-amber-600 text-xs font-bold uppercase tracking-widest mb-1">Super</p>
                            <p className="text-3xl font-black text-amber-700">{admins.filter(a => a.role === 'SUPER_ADMIN').length}</p>
                        </div>
                        <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                            <p className="text-emerald-600 text-xs font-bold uppercase tracking-widest mb-1">College</p>
                            <p className="text-3xl font-black text-emerald-700">{admins.filter(a => a.role === 'COLLEGE_ADMIN').length}</p>
                        </div>
                        <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100">
                            <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-1">Active</p>
                            <p className="text-3xl font-black text-green-700">{admins.length}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Alerts */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl flex items-center gap-3"
                        >
                            <AlertTriangle size={18} />
                            <span className="flex-1 font-bold text-sm tracking-tight">{error}</span>
                            <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg transition-colors"><X size={16} /></button>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-green-50 border border-green-100 text-green-600 px-5 py-4 rounded-2xl flex items-center gap-3"
                        >
                            <Check size={18} />
                            <span className="font-bold text-sm tracking-tight">{success}</span>
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
                        className="bg-white border border-slate-100 rounded-[32px] p-16 text-center shadow-sm"
                    >
                        <div className="w-24 h-24 bg-emerald-50 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <UserCog size={44} className="text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">No Administrators Yet</h3>
                        <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto">Create administrator accounts to help manage your organization's fleet and members.</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-premium btn-primary-gradient px-10 py-5 rounded-[20px] text-lg shadow-emerald-200"
                        >
                            Add Your First Admin
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {admins.map((admin, index) => (
                            <motion.div
                                key={admin.userId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ y: -6 }}
                                transition={{ delay: index * 0.05 }}
                                className="group bg-white border border-slate-100 rounded-[28px] p-6.5 hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 relative"
                            >
                                {admin.role === 'SUPER_ADMIN' && (
                                    <div className="absolute top-4 right-4">
                                        <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                            <Crown size={12} className="fill-amber-600/20" />
                                            Owner
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${admin.role === 'SUPER_ADMIN'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                        {admin.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-16">
                                        <h3 className="font-extrabold text-slate-900 text-lg truncate leading-tight">{admin.name}</h3>
                                        <p className="text-slate-500 text-sm font-medium truncate mt-0.5">{admin.email}</p>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-2">
                                    {admin.phone && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100">
                                            <Phone size={12} className="text-slate-400" />
                                            {admin.phone}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100/50">
                                        <Shield size={12} className="text-emerald-400" />
                                        {admin.role.replace('_', ' ')}
                                    </div>
                                </div>

                                <div className="mt-6 pt-5 border-t border-slate-50 flex gap-3">
                                    <button
                                        onClick={() => setEditAdmin(admin)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-600 rounded-[14px] text-xs font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100 hover:border-emerald-100"
                                    >
                                        <Edit size={14} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(admin.userId)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-400 rounded-[14px] text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100 hover:border-red-100"
                                    >
                                        <Trash2 size={14} />
                                        Remove
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
                            className="bg-white rounded-[32px] p-8 w-full max-w-md border border-slate-100 shadow-2xl"
                        >
                             <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <Plus size={24} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Add New Admin</h3>
                                        <p className="text-slate-500 text-sm font-medium">Create a new administrator</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleCreate} className="space-y-5">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter full name"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 input-premium"
                                    />
                                </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="admin@college.edu"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 input-premium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 input-premium"
                                    />
                                </div>
                                 <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Initial Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 input-premium"
                                    />
                                </div>
                                <div className="flex gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-6 py-4 bg-white text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 btn-premium btn-primary-gradient px-6 py-4 rounded-2xl"
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
                            className="bg-white rounded-[32px] p-8 w-full max-w-md border border-slate-100 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <Edit size={24} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Edit Admin</h3>
                                        <p className="text-slate-500 text-sm font-medium">Update account details</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditAdmin(null)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                             <form onSubmit={handleUpdate} className="space-y-5">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editAdmin.name}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, name: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 input-premium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={editAdmin.email}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, email: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 input-premium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={editAdmin.phone || ''}
                                        onChange={(e) => setEditAdmin({ ...editAdmin, phone: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 input-premium"
                                    />
                                </div>
                                <div className="flex gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEditAdmin(null)}
                                        className="flex-1 px-6 py-4 bg-white text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 btn-premium btn-primary-gradient px-6 py-4 rounded-2xl"
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
