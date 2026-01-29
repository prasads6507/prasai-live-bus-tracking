import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, X, Check, AlertTriangle } from 'lucide-react';
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
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <UserCog className="text-blue-400" />
                            Manage Admins
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Add or manage college administrators</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
                    >
                        <Plus size={18} />
                        Add Admin
                    </button>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
                        <AlertTriangle size={18} />
                        {error}
                        <button onClick={() => setError('')} className="ml-auto"><X size={16} /></button>
                    </div>
                )}
                {success && (
                    <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
                        <Check size={18} />
                        {success}
                    </div>
                )}

                {/* Admins Table */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                        </div>
                    ) : admins.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <UserCog size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No admins found. Add your first admin.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {admins.map((admin) => (
                                        <tr key={admin.userId} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                                                        {admin.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-white">{admin.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">{admin.email}</td>
                                            <td className="px-6 py-4 text-slate-400">{admin.phone || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${admin.role === 'SUPER_ADMIN'
                                                    ? 'bg-purple-500/20 text-purple-400'
                                                    : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'College Admin'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <button
                                                    onClick={() => setEditAdmin(admin)}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(admin.userId)}
                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Add New Admin</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Create Admin
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editAdmin && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Edit Admin</h3>
                            <button onClick={() => setEditAdmin(null)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editAdmin.name}
                                    onChange={(e) => setEditAdmin({ ...editAdmin, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={editAdmin.email}
                                    onChange={(e) => setEditAdmin({ ...editAdmin, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={editAdmin.phone || ''}
                                    onChange={(e) => setEditAdmin({ ...editAdmin, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditAdmin(null)}
                                    className="flex-1 px-4 py-3 bg-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CollegeAdmins;
