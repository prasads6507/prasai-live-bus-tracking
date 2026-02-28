import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, X, CheckCircle, Users, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import { getStudents, getBusStudents, assignStudentsToBus } from '../services/api';

interface Student {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    registerNumber?: string;
    rollNumber?: string;
    assignedBusId?: string | null;
}

const BusStudents = () => {
    const { orgSlug, busId } = useParams<{ orgSlug: string; busId: string }>();
    const navigate = useNavigate();

    // All students from the org
    const [allStudents, setAllStudents] = useState<Student[]>([]);

    // Students already assigned to this bus (loaded from DB)
    const [existingStudents, setExistingStudents] = useState<Student[]>([]);

    // Students staged to be added in this session (pending submit)
    const [stagedStudents, setStagedStudents] = useState<Student[]>([]);

    // Bus number display
    const [busNumber, setBusNumber] = useState<string>('');

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Student[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // UI state
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchData();
    }, [busId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch all org students + students already assigned to this bus
            const [studentsRes, busStudentsRes] = await Promise.all([
                getStudents(),
                getBusStudents(busId!),
            ]);

            const students: Student[] = studentsRes?.data || studentsRes || [];
            const busData = busStudentsRes?.data || busStudentsRes || {};

            setBusNumber(busData.busNumber || busId || '');
            setExistingStudents(busData.students || []);
            setAllStudents(students);
        } catch (err: any) {
            setErrorMessage(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Live search filtering
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        const q = searchQuery.toLowerCase();
        const alreadyStagedIds = new Set(stagedStudents.map(s => s._id));
        const alreadyAssignedIds = new Set(existingStudents.map(s => s._id));

        const results = allStudents
            .filter(s =>
                !alreadyStagedIds.has(s._id) &&
                !alreadyAssignedIds.has(s._id) &&
                (
                    (String(s.name || '')).toLowerCase().includes(q) ||
                    (String(s.email || '')).toLowerCase().includes(q) ||
                    (String(s.registerNumber || '')).toLowerCase().includes(q)
                )
            )
            .slice(0, 8);

        setSearchResults(results);
        setShowDropdown(results.length > 0);
    }, [searchQuery, allStudents, stagedStudents, existingStudents]);

    const handleSelectStudent = (student: Student) => {
        setStagedStudents(prev => [...prev, student]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleRemoveStaged = (studentId: string) => {
        setStagedStudents(prev => prev.filter(s => s._id !== studentId));
    };

    const handleRemoveExisting = async (studentId: string) => {
        if (!confirm('Remove this student from the bus?')) return;
        try {
            // Unassign: assign with busId = null
            await assignStudentsToBus(busId!, [{ studentId, action: 'remove' }]);
            setExistingStudents(prev => prev.filter(s => s._id !== studentId));
            setSuccessMessage('Student removed from bus.');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            setErrorMessage(err.response?.data?.message || 'Failed to remove student');
            setTimeout(() => setErrorMessage(''), 4000);
        }
    };

    const handleSubmit = async () => {
        if (stagedStudents.length === 0) return;

        setSubmitting(true);
        setErrorMessage('');
        try {
            const assignments = stagedStudents.map(s => ({ studentId: s._id || (s as any).studentId, action: 'add' as 'add' | 'remove' }));
            console.log('Submitting assignments:', assignments);
            await assignStudentsToBus(busId!, assignments);

            const addedCount = stagedStudents.length;
            setSuccessMessage(`${addedCount} student(s) successfully assigned to Bus ${busNumber}!`);

            // Move staged → existing
            setExistingStudents(prev => [...prev, ...stagedStudents]);
            setStagedStudents([]);

            // Auto close success after 5s
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err: any) {
            console.error('Assignment error:', err);
            setErrorMessage(err.response?.data?.message || 'Failed to assign students. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getInitials = (name?: string) => {
        if (!name) return 'S';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <Layout activeItem="buses">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </Layout>
        );
    }

    const totalAssigned = existingStudents.length + stagedStudents.length;

    return (
        <Layout activeItem="buses">
            <div className="p-6">
                <div className="max-w-3xl mx-auto">

                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => navigate(`/${orgSlug}/buses`)}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors text-sm"
                        >
                            <ArrowLeft size={16} />
                            Back to Buses
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                                <Users className="text-blue-600" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">
                                    Assign Students — Bus {busNumber}
                                </h1>
                                <p className="text-slate-500 text-sm">
                                    {totalAssigned} student{totalAssigned !== 1 ? 's' : ''} assigned
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Toast Messages */}
                    <AnimatePresence>
                        {successMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl"
                            >
                                <CheckCircle size={18} />
                                {successMessage}
                            </motion.div>
                        )}
                        {errorMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl"
                            >
                                <X size={18} />
                                {errorMessage}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Search Bar */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 className="text-base font-semibold text-slate-700 mb-4">Search & Add Students</h2>
                        <div ref={searchRef} className="relative">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, or register number..."
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Search Dropdown */}
                            <AnimatePresence>
                                {showDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="absolute z-10 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                                    >
                                        {searchResults.map(student => (
                                            <button
                                                key={student._id}
                                                onClick={() => handleSelectStudent(student)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-0"
                                            >
                                                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-blue-600 text-xs font-bold">
                                                        {getInitials(student.name)}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 text-sm truncate">{student.name}</p>
                                                    <p className="text-slate-500 text-xs truncate">{student.email}</p>
                                                </div>
                                                {student.registerNumber && (
                                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                                        {student.registerNumber}
                                                    </span>
                                                )}
                                                {stagedStudents.some(st => st._id === student._id) ? (
                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                                                        <CheckCircle size={10} />
                                                        Staged
                                                    </span>
                                                ) : student.assignedBusId && student.assignedBusId !== busId ? (
                                                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex-shrink-0">
                                                        On another bus
                                                    </span>
                                                ) : null}
                                                <UserPlus size={16} className="text-blue-400 flex-shrink-0" />
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        {searchQuery && searchResults.length === 0 && (
                            <p className="text-slate-400 text-sm mt-2 text-center">No matching students found.</p>
                        )}
                    </div>

                    {/* Staged Students (to be submitted) */}
                    <AnimatePresence>
                        {stagedStudents.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-base font-semibold text-blue-800">
                                        Ready to Assign ({stagedStudents.length})
                                    </h2>
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                        Pending — click Submit to save
                                    </span>
                                </div>

                                <div className="space-y-2 mb-5">
                                    <AnimatePresence>
                                        {stagedStudents.map((student, idx) => (
                                            <motion.div
                                                key={student._id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-blue-100"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-blue-600 text-xs font-bold">
                                                        {getInitials(student.name)}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 text-sm truncate">{student.name}</p>
                                                    <p className="text-slate-500 text-xs truncate">
                                                        {student.registerNumber || student.email}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveStaged(student._id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Assigning...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            Submit — Assign {stagedStudents.length} Student{stagedStudents.length !== 1 ? 's' : ''} to Bus {busNumber}
                                        </>
                                    )}
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Already Assigned Students */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-700">
                                Assigned Students
                            </h2>
                            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                {existingStudents.length} total
                            </span>
                        </div>

                        {existingStudents.length === 0 ? (
                            <div className="px-6 py-12 text-center text-slate-400">
                                <Users size={40} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">No students assigned to this bus yet.</p>
                                <p className="text-xs mt-1">Search above to add students.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {existingStudents.map((student, idx) => (
                                    <motion.div
                                        key={student._id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <span className="text-green-700 text-xs font-bold">
                                                {getInitials(student.name)}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm">{student.name}</p>
                                            <p className="text-slate-500 text-xs">
                                                {student.registerNumber
                                                    ? `Reg: ${student.registerNumber}`
                                                    : student.email}
                                                {student.phone ? ` · ${student.phone}` : ''}
                                            </p>
                                        </div>
                                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                            <CheckCircle size={12} />
                                            Assigned
                                        </span>
                                        <button
                                            onClick={() => handleRemoveExisting(student._id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove from bus"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </Layout>
    );
};

export default BusStudents;
