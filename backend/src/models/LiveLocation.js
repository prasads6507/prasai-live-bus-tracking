const mongoose = require('mongoose');

const liveLocationSchema = new mongoose.Schema({
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    busId: {
        type: String,
        required: true,
        index: true
    },
    tripId: {
        type: String,
        required: true,
        index: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    speed: Number, // km/h
    lastUpdatedAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // Auto-delete after 24 hours
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('LiveLocation', liveLocationSchema);
