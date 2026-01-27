import { useState, useEffect } from 'react';
import { User, Plus, Search, Mail, Phone, Hash, X, AlertCircle, CheckCircle, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { getStudents, createStudent, updateStudent, deleteStudent, bulkCreateStudents } from '../services/api';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

interface Student {
    studentId: string;
    name: string;
    registerNumber: string;
    rollNumber: string;
    email: string;
    phone: string;
}

const Students = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newStudent, setNewStudent] = useState({
        name: '',
        registerNumber: '',
        rollNumber: '',
        email: '',
        phone: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // Bulk Upload State
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkPreview, setBulkPreview] = useState<any[]>([]);
    const [selectedBulkIndices, setSelectedBulkIndices] = useState<number[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkError, setBulkError] = useState('');
    const [bulkSuccess, setBulkSuccess] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            setError('');
            const response = await getStudents();
            setStudents(response.data || []);
        } catch (err: any) {
            console.error("Failed to fetch students:", err);
            setError(err.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        try {
            if (isEditMode && editingStudent) {
                await updateStudent(editingStudent.studentId, newStudent);
                setSuccessMessage(`Student ${newStudent.name} updated successfully!`);
            } else {
                await createStudent(newStudent);
                setSuccessMessage(`Student ${newStudent.name} created successfully!`);
            }

            setNewStudent({ name: '', registerNumber: '', rollNumber: '', email: '', phone: '' });
            setIsEditMode(false);
            setEditingStudent(null);
            fetchStudents();
            setTimeout(() => {
                setSuccessMessage('');
                setIsModalOpen(false);
            }, 1500);
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Operation failed');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditStudent = (student: Student) => {
        setEditingStudent(student);
        setNewStudent({
            name: student.name,
            registerNumber: student.registerNumber,
            rollNumber: student.rollNumber || '',
            email: student.email,
            phone: student.phone || ''
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDeleteStudent = async (studentId: string, studentName: string) => {
        if (!confirm(`Are you sure you want to delete ${studentName}?`)) return;

        try {
            await deleteStudent(studentId);
            fetchStudents();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to delete student');
        }
    };

    const downloadStudentTemplate = () => {
        const headers = [['Name', 'Register Number', 'Roll Number', 'Email', 'Phone']];
        const data = students.length > 0
            ? students.map(s => [s.name, s.registerNumber, s.rollNumber || '', s.email, s.phone || ''])
            : [['John Doe', 'REG001', 'R001', 'john@example.com', '9876543210']];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...data]);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'Students_Template.xlsx');
    };

    const handleProcessFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const mappedData = jsonData.map((row: any) => ({
                name: row['Name'] || row['name'] || '',
                registerNumber: row['Register Number'] || row['registerNumber'] || '',
                rollNumber: row['Roll Number'] || row['rollNumber'] || '',
                email: row['Email'] || row['email'] || '',
                phone: row['Phone'] || row['phone'] || ''
            })).filter(s => s.name && s.registerNumber && s.email);

            if (mappedData.length === 0) {
                setBulkError('No valid students found. Check column headers.');
                return;
            }

            setBulkPreview(mappedData);
            setSelectedBulkIndices(mappedData.map((_, i) => i));
            setBulkError('');
            e.target.value = '';
        } catch (err) {
            console.error(err);
            setBulkError('Failed to parse file');
        }
    };

    const handleBulkUpload = async () => {
        const selectedStudents = bulkPreview.filter((_, i) => selectedBulkIndices.includes(i));
        if (selectedStudents.length === 0) return;

        setBulkLoading(true);
        setBulkError('');

        try {
            const result = await bulkCreateStudents(selectedStudents);
            setBulkSuccess(`Created ${result.results?.created || 0} students`);
            fetchStudents();
            setTimeout(() => {
                setBulkPreview([]);
                setSelectedBulkIndices([]);
                setBulkSuccess('');
                setIsBulkModalOpen(false);
            }, 2000);
        } catch (err: any) {
            setBulkError(err.response?.data?.message || 'Bulk upload failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedBulkIndices.length === bulkPreview.length) {
            setSelectedBulkIndices([]);
        } else {
            setSelectedBulkIndices(bulkPreview.map((_, i) => i));
        }
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout activeItem="students">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Student Management</h1>
                        <p className="text-slate-500 mt-1">Manage student records</p>
                    </div>
                    <div className="flex gap-2">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsBulkModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                        >
                            <Upload size={18} />
                            Bulk Upload
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                setIsEditMode(false);
                                setEditingStudent(null);
                                setNewStudent({ name: '', registerNumber: '', rollNumber: '', email: '', phone: '' });
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold shadow-lg shadow-blue-200"
                        >
                            <Plus size={20} />
                            Add Student
                        </motion.button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or register number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                    />
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 flex items-start gap-3">
                        <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                        <p>{error}</p>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                        <User size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-1">No Students Found</h3>
                        <p className="text-slate-500">Add your first student or try a different search</p>
                    </div>
                ) : (
                    /* Student Cards */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredStudents.map((student) => (
                            <motion.div
                                key={student.studentId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-lg transition-all group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600 font-bold text-lg">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{student.name}</h3>
                                            <p className="text-sm text-slate-500">{student.registerNumber}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditStudent(student)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteStudent(student.studentId, student.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-slate-600"><Mail size={14} className="text-slate-400" />{student.email}</div>
                                    {student.rollNumber && <div className="flex items-center gap-2 text-slate-600"><Hash size={14} className="text-slate-400" />{student.rollNumber}</div>}
                                    {student.phone && <div className="flex items-center gap-2 text-slate-600"><Phone size={14} className="text-slate-400" />{student.phone}</div>}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-800">{isEditMode ? 'Edit Student' : 'Add New Student'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
                            </div>

                            {successMessage ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"><CheckCircle size={32} className="text-green-600" /></div>
                                    <p className="text-lg font-semibold text-slate-800">{successMessage}</p>
                                </div>
                            ) : (
                                <form onSubmit={handleCreateStudent} className="space-y-4">
                                    {formError && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-lg text-sm">{formError}</div>}
                                    <div><label className="block text-sm font-semibold text-slate-700 mb-2">Name *</label><input type="text" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100" /></div>
                                    <div><label className="block text-sm font-semibold text-slate-700 mb-2">Register Number *</label><input type="text" value={newStudent.registerNumber} onChange={(e) => setNewStudent({ ...newStudent, registerNumber: e.target.value })} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100" /></div>
                                    <div><label className="block text-sm font-semibold text-slate-700 mb-2">Roll Number</label><input type="text" value={newStudent.rollNumber} onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100" /></div>
                                    <div><label className="block text-sm font-semibold text-slate-700 mb-2">Email *</label><input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100" /></div>
                                    <div><label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label><input type="tel" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100" /></div>
                                    <motion.button type="submit" disabled={formLoading} className="w-full mt-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200 disabled:opacity-50">{formLoading ? 'Saving...' : isEditMode ? 'Update Student' : 'Create Student'}</motion.button>
                                </form>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Upload Modal */}
            <AnimatePresence>
                {isBulkModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setIsBulkModalOpen(false)}
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
                                    <h2 className="text-2xl font-bold text-slate-800">Bulk Upload Students</h2>
                                    <p className="text-slate-500 text-sm">Upload Excel with Name, Register Number, Roll Number, Email, Phone</p>
                                </div>
                                <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                {bulkSuccess ? (
                                    <div className="flex flex-col items-center justify-center py-12"><div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><CheckCircle size={32} /></div><h3 className="text-xl font-bold text-slate-800">{bulkSuccess}</h3></div>
                                ) : (
                                    <>
                                        {bulkError && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-lg text-sm mb-4">{bulkError}</div>}

                                        {bulkPreview.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center">
                                                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer w-full max-w-xl group" onClick={() => document.getElementById('student-file-input')?.click()}>
                                                    <input id="student-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleProcessFile} />
                                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-blue-500"><Upload size={32} /></div>
                                                    <p className="font-bold text-slate-700 text-lg">Click to Upload Excel File</p>
                                                    <button onClick={(e) => { e.stopPropagation(); downloadStudentTemplate(); }} className="mt-6 flex items-center gap-2 text-blue-600 font-bold hover:underline"><Download size={16} /> Download Template</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex flex-col min-h-0">
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={selectedBulkIndices.length === bulkPreview.length} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600 rounded" /><span className="text-sm font-medium text-slate-700">Select All ({bulkPreview.length})</span></label>
                                                    <button onClick={() => { setBulkPreview([]); setSelectedBulkIndices([]); }} className="text-red-500 text-sm hover:underline">Clear & Upload New</button>
                                                </div>
                                                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                                            <tr><th className="p-3 w-10"></th><th className="p-3 font-semibold">Name</th><th className="p-3 font-semibold">Register No</th><th className="p-3 font-semibold">Roll No</th><th className="p-3 font-semibold">Email</th><th className="p-3 font-semibold">Phone</th></tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {bulkPreview.map((row, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50">
                                                                    <td className="p-3"><input type="checkbox" checked={selectedBulkIndices.includes(idx)} onChange={() => { if (selectedBulkIndices.includes(idx)) { setSelectedBulkIndices(selectedBulkIndices.filter(i => i !== idx)); } else { setSelectedBulkIndices([...selectedBulkIndices, idx]); } }} className="w-4 h-4 text-blue-600 rounded" /></td>
                                                                    <td className="p-3 font-medium text-slate-800">{row.name}</td>
                                                                    <td className="p-3 text-slate-600">{row.registerNumber}</td>
                                                                    <td className="p-3 text-slate-600">{row.rollNumber}</td>
                                                                    <td className="p-3 text-slate-600">{row.email}</td>
                                                                    <td className="p-3 text-slate-600">{row.phone}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <button onClick={handleBulkUpload} disabled={bulkLoading || selectedBulkIndices.length === 0} className="mt-6 w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 disabled:opacity-50">{bulkLoading ? 'Processing...' : `Import ${selectedBulkIndices.length} Students`}</button>
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

export default Students;
