const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
    assignmentId: {
        type: String,
        required: true,
        unique: true,
        default: () => new mongoose.Types.ObjectId().toString()
    },
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    busId: {
        type: String,
        required: true
    },
    routeId: String, // Optional for students, maybe specific stop needed later
    role: { // 'DRIVER' or 'STUDENT'
        type: String,
        required: true
    },
    stopId: String // For students assigned to specific pickup stop
}, {
    timestamps: true
});

module.exports = mongoose.model('Assignment', assignmentSchema);
