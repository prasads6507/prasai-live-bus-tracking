const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
    busId: {
        type: String,
        required: true,
        unique: true
    },
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    busNumber: {
        type: String,
        required: true
    },
    plateNumber: {
        type: String,
        required: true
    },
    capacity: Number,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Bus', busSchema);
