import React, { useEffect, useState } from 'react';
import { getColleges, createCollege, updateCollegeStatus, deleteCollege } from '../services/owner.service';
import type { College } from '../services/owner.service';

const Colleges: React.FC = () => {
    const [colleges, setColleges] = useState<College[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        collegeName: '',
        branch: '',
        address: '',
        slug: '',
        facultyName: '',
        facultyEmail: '',
        password: '',
        phone: ''
    });

    useEffect(() => {
        fetchColleges();
    }, []);

    const fetchColleges = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getColleges();
            setColleges(data);
        } catch (error: any) {
            console.error('Failed to fetch colleges', error);
            setError('Failed to load organization list. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await createCollege(formData);
            setShowAddModal(false);
            fetchColleges();
            setFormData({
                collegeName: '',
                branch: '',
                address: '',
                slug: '',
                facultyName: '',
                facultyEmail: '',
                password: '',
                phone: ''
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create college');
        }
    };

    const toggleStatus = async (college: College) => {
        const newStatus = college.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        if (window.confirm(`Are you sure you want to ${newStatus} this college?`)) {
            try {
                await updateCollegeStatus(college.collegeId, newStatus);
                fetchColleges();
            } catch (error) {
                alert('Failed to update status');
            }
        }
    };

    const handleDelete = async (collegeId: string) => {
        if (window.confirm('Are you sure you want to DELETE this college? This action cannot be undone and will remove all associated users and data.')) {
            try {
                await deleteCollege(collegeId);
                fetchColleges();
            } catch (error: any) {
                console.error("Delete failed:", error);
                alert(`Failed to delete college: ${error.response?.data?.message || error.message}`);
            }
        }
    };

    const handleDownload = () => {
        const headers = ['College Name,ID,Status,Address,Email,Phone'];
        const rows = colleges.map(c =>
            `${c.collegeName},${c.collegeId},${c.status},"${c.address || ''}","${c.contactEmail || ''}","${c.contactPhone || ''}"`
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "colleges_list.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Manage Organizations</h1>
                    <p className="text-gray-500">Add and manage colleges/organizations on the platform</p>
                </div>
                <div className="space-x-4">
                    <button
                        onClick={handleDownload}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm"
                    >
                        Download CSV
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-md"
                    >
                        + Add New Organization
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Data Load Error Banner */}
                    {error && !showAddModal && !error.includes('create') && (
                        <div className="bg-red-50 p-4 border-b border-red-100 flex items-center text-red-700">
                            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            {error}
                            <button onClick={fetchColleges} className="ml-auto text-sm font-bold underline hover:text-red-900">Retry</button>
                        </div>
                    )}

                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">College / Organization</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Slug (ID)</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {colleges.map((college) => (
                                <tr key={college._id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-900">{college.collegeName}</span>
                                            <span className="text-xs text-gray-400">{college.address}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{college.collegeId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${college.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {college.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <button
                                            onClick={() => toggleStatus(college)}
                                            className={`${college.status === 'ACTIVE' ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                                        >
                                            {college.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(college.collegeId)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Combined Onboarding Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center z-10">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">Onboard New Organization</h3>
                                <p className="text-sm text-gray-500">Create organization and assign primary administrator</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-8">
                            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Section 1: College Details */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-600 uppercase text-xs tracking-widest border-b pb-2">1. Organization Details</h4>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">College Name*</label>
                                        <input type="text" required placeholder="e.g. Stanford University" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            value={formData.collegeName} onChange={e => setFormData({ ...formData, collegeName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Branch</label>
                                        <input type="text" placeholder="e.g. Engineering" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.branch} onChange={e => setFormData({ ...formData, branch: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Organization Slug* (URL)</label>
                                        <div className="flex">
                                            <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-3 py-2 text-gray-500 text-sm">prasai.com/</span>
                                            <input type="text" required placeholder="stanford-eng" className="w-full border border-gray-300 rounded-r-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Used for unique identification</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                                        <textarea className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-20"
                                            value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                </div>

                                {/* Section 2: Admin Details */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-600 uppercase text-xs tracking-widest border-b pb-2">2. Faculty Administrator</h4>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name*</label>
                                        <input type="text" required placeholder="e.g. Dr. John Doe" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.facultyName} onChange={e => setFormData({ ...formData, facultyName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Faculty Email*</label>
                                        <input type="email" required placeholder="admin@college.com" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.facultyEmail} onChange={e => setFormData({ ...formData, facultyEmail: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Set Password*</label>
                                        <input type="password" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                                        <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition">
                                    Cancel
                                </button>
                                <button type="submit" className="px-10 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                                    Finalize Onboarding
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Colleges;
