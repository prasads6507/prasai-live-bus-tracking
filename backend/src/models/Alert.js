const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['SOS', 'OVERSPEED'],
        required: true
    },
    busId: {
        type: String,
        required: true
    },
    message: String,
    location: {
        latitude: Number,
        longitude: Number
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolvedBy: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);
