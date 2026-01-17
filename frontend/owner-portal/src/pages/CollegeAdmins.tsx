import React, { useState, useEffect } from 'react';
import { getColleges, createCollegeAdmin, deleteCollegeAdmin, getCollegeAdmins, updateCollegeAdmin } from '../services/owner.service';
import type { College, CollegeAdmin } from '../services/owner.service';

const CollegeAdmins: React.FC = () => {
    const [colleges, setColleges] = useState<College[]>([]);
    const [admins, setAdmins] = useState<CollegeAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<any>(null);
    const [editAdmin, setEditAdmin] = useState<CollegeAdmin | null>(null);
    const [filterCollegeId, setFilterCollegeId] = useState('ALL');
    const [error, setError] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        collegeId: '',
        name: '',
        email: '',
        phone: '',
        password: ''
    });

    const [editPwd, setEditPwd] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');

        // Independent fetching to prevent one failure from blocking the other
        try {
            const collegesData = await getColleges();
            setColleges(collegesData);
            if (collegesData.length > 0) {
                setFormData(prev => ({ ...prev, collegeId: collegesData[0].collegeId }));
            }
        } catch (err) {
            console.error('Failed to fetch colleges', err);
            // Don't set global error yet, allowing admins to try loading
        }

        try {
            const adminsData = await getCollegeAdmins();
            setAdmins(adminsData);
        } catch (err: any) {
            console.error('Failed to fetch admins', err);
            setError('Failed to load administrators list. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await createCollegeAdmin(formData);
            const updatedAdmins = await getCollegeAdmins();
            setAdmins(updatedAdmins);

            setCreatedCredentials({
                email: formData.email,
                password: formData.password,
                college: colleges.find(c => c.collegeId === formData.collegeId)?.collegeName
            });

            setShowAddModal(false);
            setFormData({
                collegeId: colleges.length > 0 ? colleges[0].collegeId : '',
                name: '', email: '', phone: '', password: ''
            });
        } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to create admin');
        }
    };

    const handleDelete = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this admin?')) {
            try {
                await deleteCollegeAdmin(userId);
                const updatedAdmins = await getCollegeAdmins();
                setAdmins(updatedAdmins);
            } catch (error: any) {
                alert(`Failed to delete admin: ${error.response?.data?.message || 'Unknown error'}`);
            }
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editAdmin) return;
        try {
            await updateCollegeAdmin(editAdmin.userId, {
                name: editAdmin.name,
                email: editAdmin.email,
                phone: editAdmin.phone,
                role: editAdmin.role,
                password: editPwd !== '' ? editPwd : undefined
            });
            setEditAdmin(null);
            setEditPwd('');
            const updatedAdmins = await getCollegeAdmins();
            setAdmins(updatedAdmins);
        } catch (error: any) {
            alert(`Failed to update admin: ${error.response?.data?.message || 'Unknown error'}`);
        }
    };

    const filteredAdmins = filterCollegeId === 'ALL'
        ? admins
        : admins.filter(admin => admin.collegeId === filterCollegeId);

    const handleDownload = () => {
        const headers = ['Name,Email,Phone,College,Role'];
        const rows = filteredAdmins.map(a =>
            `${a.name},${a.email},${a.phone},${a.collegeName || a.collegeId},${a.role || 'COLLEGE_ADMIN'}`
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const fileName = filterCollegeId === 'ALL'
            ? 'all_college_admins.csv'
            : `${colleges.find(c => c.collegeId === filterCollegeId)?.collegeName || 'college'}_admins.csv`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Manage College Admins</h1>
                    <p className="text-gray-500">Manage primary faculty administrators for each organization</p>
                </div>
                <div className="space-x-4">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-md font-bold"
                    >
                        + Add New Admin
                    </button>
                    <button
                        onClick={handleDownload}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm font-bold"
                    >
                        Download CSV
                    </button>
                </div>
            </div>

            {/* Filter Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center space-x-4">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filter by Organization:</span>
                <select
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none max-w-[300px] truncate font-medium"
                    value={filterCollegeId}
                    onChange={e => setFilterCollegeId(e.target.value)}
                >
                    <option value="ALL">All Colleges</option>
                    {colleges.map(c => (
                        <option key={c._id} value={c.collegeId} className="max-w-full truncate">{c.collegeName}</option>
                    ))}
                </select>
            </div>

            {/* Admins Table (Full Width) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {error && (
                    <div className="bg-red-50 p-4 border-b border-red-100 flex items-center text-red-700">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        {error}
                    </div>
                )}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Administrator</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Organization</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Org Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Contact Details</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAdmins.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-medium italic">No administrators found for the selected filter</td></tr>
                                ) : (
                                    filteredAdmins.map(admin => (
                                        <tr key={admin.userId} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 border border-blue-200">
                                                        {admin.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-gray-900">{admin.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-gray-600 px-2 py-1 bg-gray-100 rounded">
                                                    {admin.collegeName || admin.collegeId}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-[10px] leading-5 font-bold rounded uppercase ${admin.role === 'SUPER_ADMIN'
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                    }`}>
                                                    {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'College Admin'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full border ${admin.collegeStatus === 'SUSPENDED'
                                                    ? 'bg-red-100 text-red-700 border-red-200'
                                                    : 'bg-green-100 text-green-700 border-green-200'
                                                    }`}>
                                                    {admin.collegeStatus || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-700">{admin.email}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold">{admin.phone || 'No phone'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                                <button
                                                    onClick={() => setEditAdmin(admin)}
                                                    className={`transition font-bold ${admin.collegeStatus === 'SUSPENDED' ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-900'}`}
                                                    disabled={admin.collegeStatus === 'SUSPENDED'}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(admin.userId)}
                                                    className="text-red-500 hover:text-red-700 transition font-bold"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Admin Modal (Revamped) */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
                        <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center rounded-t-2xl">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">Add New Administrator</h3>
                                <p className="text-sm text-gray-500">Create a primary account for faculty management</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-8">
                            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Section 1: Assignment */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-600 uppercase text-xs tracking-widest border-b pb-2">1. Organization Assignment</h4>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Select Organization*</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium truncate"
                                            value={formData.collegeId}
                                            onChange={e => setFormData({ ...formData, collegeId: e.target.value })}
                                            required
                                        >
                                            {colleges.map(c => (
                                                <option key={c._id} value={c.collegeId} className="truncate">{c.collegeName}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-400 mt-2 uppercase">Assign admin to an existing college</p>
                                    </div>
                                </div>

                                {/* Section 2: Personal Profile */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-600 uppercase text-xs tracking-widest border-b pb-2">2. Administrator Profile</h4>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name*</label>
                                        <input type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address*</label>
                                        <input type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Set Password*</label>
                                        <input type="password" required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                                        <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition">
                                    Cancel
                                </button>
                                <button type="submit" className="px-10 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                                    Finalize Creation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credentials Modal */}
            {createdCredentials && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center border-t-8 border-green-500">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-2xl font-extrabold mb-2 text-gray-800">Admin Account Created</h3>
                        <p className="text-gray-500 mb-6 font-medium">Please securely share these credentials with the faculty admin.</p>

                        <div className="bg-gray-50 p-6 rounded-xl mb-6 text-left border border-gray-100 space-y-3">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Organization</p>
                                <p className="font-bold text-gray-700">{createdCredentials.college}</p>
                            </div>
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Username / Email</p>
                                <p className="font-mono font-bold text-blue-600">{createdCredentials.email}</p>
                            </div>
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Initial Password</p>
                                <p className="font-mono font-bold text-red-500">{createdCredentials.password}</p>
                            </div>
                        </div>

                        <div className="flex bg-yellow-50 p-3 rounded-lg border border-yellow-100 mb-6">
                            <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <p className="text-[10px] text-yellow-800 text-left font-bold uppercase leading-tight">For security, this password will not be shown again. Ensure it is copied.</p>
                        </div>

                        <button
                            onClick={() => setCreatedCredentials(null)}
                            className="w-full bg-slate-800 text-white font-bold px-6 py-3 rounded-xl hover:bg-slate-900 transition shadow-lg"
                        >
                            I Have Copied the Details
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Modal (Revamped) */}
            {editAdmin && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center rounded-t-2xl">
                            <h3 className="text-xl font-bold text-gray-800">Edit Administrator</h3>
                            <button onClick={() => setEditAdmin(null)} className="text-gray-400 hover:text-gray-600 p-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="p-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                    <input type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editAdmin.name} onChange={e => setEditAdmin({ ...editAdmin, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                                    <input type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editAdmin.email} onChange={e => setEditAdmin({ ...editAdmin, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                                    <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editAdmin.phone} onChange={e => setEditAdmin({ ...editAdmin, phone: e.target.value })} />
                                </div>
                                <div className="mt-4 pt-6 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-gray-800 mb-1">Reset Password (Optional)</label>
                                    <input type="password" placeholder="Enter new password to reset" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editPwd} onChange={e => setEditPwd(e.target.value)} />
                                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase">Leave blank to keep current password</p>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Role Permission</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        value={editAdmin.role || 'COLLEGE_ADMIN'}
                                        onChange={e => setEditAdmin({ ...editAdmin, role: e.target.value as any })}
                                    >
                                        <option value="COLLEGE_ADMIN">College Admin (Standard)</option>
                                        <option value="SUPER_ADMIN">Super Admin (Primary)</option>
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase">
                                        Super Admins are the main contact for the organization.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-8">
                                <button type="button" onClick={() => setEditAdmin(null)} className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollegeAdmins;
