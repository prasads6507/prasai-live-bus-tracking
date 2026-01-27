const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

// @desc    Create a single student
// @route   POST /api/admin/students
// @access  Private (College Admin)
const createStudent = async (req, res) => {
    try {
        const { name, registerNumber, rollNumber, email, phone } = req.body;
        const collegeId = req.collegeId;

        if (!name || !registerNumber || !email) {
            return res.status(400).json({ message: 'Name, Register Number, and Email are required' });
        }

        // Check if student with this email or register number already exists
        const existingByEmail = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('email', '==', email)
            .get();
        if (!existingByEmail.empty) {
            return res.status(400).json({ message: 'Student with this email already exists' });
        }

        const existingByRegNo = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('registerNumber', '==', registerNumber)
            .get();
        if (!existingByRegNo.empty) {
            return res.status(400).json({ message: 'Student with this register number already exists' });
        }

        const studentId = 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const studentData = {
            studentId,
            collegeId,
            name,
            registerNumber,
            rollNumber: rollNumber || '',
            email,
            phone: phone || '',
            passwordHash: null, // Will be set on first login
            isFirstLogin: true,
            createdAt: new Date().toISOString()
        };

        await db.collection('students').doc(studentId).set(studentData);

        res.status(201).json({ success: true, data: { ...studentData, passwordHash: undefined } });
    } catch (error) {
        console.error('Create student error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all students for a college
// @route   GET /api/admin/students
// @access  Private (College Admin)
const getStudents = async (req, res) => {
    try {
        const collegeId = req.collegeId;
        let snapshot;
        try {
            snapshot = await db.collection('students')
                .where('collegeId', '==', collegeId)
                .orderBy('createdAt', 'desc')
                .get();
        } catch (error) {
            // Fallback: If index is missing, fetch without sorting
            if (error.code === 9 || error.message.includes('requires an index')) {
                console.warn('Index missing for sorting. Fetching unordered data.');
                snapshot = await db.collection('students')
                    .where('collegeId', '==', collegeId)
                    .get();
            } else {
                throw error;
            }
        }

        const students = snapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, passwordHash: undefined }; // Don't expose password hash
        });

        // Manual sort in memory if fallback was used
        students.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, data: students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a student
// @route   PUT /api/admin/students/:id
// @access  Private (College Admin)
const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, registerNumber, rollNumber, email, phone } = req.body;
        const collegeId = req.collegeId;

        const studentRef = db.collection('students').doc(id);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists || studentDoc.data().collegeId !== collegeId) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const updates = {};
        if (name) updates.name = name;
        if (registerNumber) updates.registerNumber = registerNumber;
        if (rollNumber !== undefined) updates.rollNumber = rollNumber;
        if (email) updates.email = email;
        if (phone !== undefined) updates.phone = phone;

        await studentRef.update(updates);

        res.json({ success: true, message: 'Student updated' });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a student
// @route   DELETE /api/admin/students/:id
// @access  Private (College Admin)
const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const collegeId = req.collegeId;

        const studentRef = db.collection('students').doc(id);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists || studentDoc.data().collegeId !== collegeId) {
            return res.status(404).json({ message: 'Student not found' });
        }

        await studentRef.delete();

        res.json({ success: true, message: 'Student deleted' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk create students from JSON
// @route   POST /api/admin/students/bulk-json
// @access  Private (College Admin)
const createBulkStudents = async (req, res) => {
    try {
        const { students } = req.body;
        const collegeId = req.collegeId;

        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: 'No students provided' });
        }

        const batch = db.batch();
        const results = { success: [], errors: [], created: 0 };

        // Get existing students for duplicate check
        const existingSnapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .get();
        const existingEmails = new Set(existingSnapshot.docs.map(d => d.data().email));
        const existingRegNos = new Set(existingSnapshot.docs.map(d => d.data().registerNumber));

        for (const student of students) {
            try {
                const { name, registerNumber, rollNumber, email, phone } = student;

                if (!name || !registerNumber || !email) {
                    results.errors.push({ student, error: 'Missing required fields (name, registerNumber, email)' });
                    continue;
                }

                if (existingEmails.has(email)) {
                    results.errors.push({ student, error: `Email ${email} already exists` });
                    continue;
                }

                if (existingRegNos.has(registerNumber)) {
                    results.errors.push({ student, error: `Register Number ${registerNumber} already exists` });
                    continue;
                }

                const studentId = 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                const studentData = {
                    studentId,
                    collegeId,
                    name,
                    registerNumber,
                    rollNumber: rollNumber || '',
                    email,
                    phone: phone || '',
                    passwordHash: null,
                    isFirstLogin: true,
                    createdAt: new Date().toISOString()
                };

                batch.set(db.collection('students').doc(studentId), studentData);
                existingEmails.add(email); // Prevent duplicates within same batch
                existingRegNos.add(registerNumber);
                results.success.push(email);
                results.created++;

            } catch (err) {
                results.errors.push({ student, error: err.message });
            }
        }

        if (results.created > 0) {
            await batch.commit();
        }

        res.json({
            message: `Created ${results.created} students`,
            results
        });
    } catch (error) {
        console.error('Bulk create students error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get student's assigned bus
// @route   GET /api/student/my-bus
// @access  Private (Student)
const getMyBus = async (req, res) => {
    // Placeholder for future implementation
    res.json({ message: 'Bus assignment tracking coming soon' });
};

// @desc    Get live location of student's bus
// @route   GET /api/student/live-location
// @access  Private (Student)
const getLiveLocation = async (req, res) => {
    // Placeholder for future implementation
    res.json({ message: 'Live tracking coming soon' });
};

module.exports = {
    createStudent,
    getStudents,
    updateStudent,
    deleteStudent,
    createBulkStudents,
    getMyBus,
    getLiveLocation
};
