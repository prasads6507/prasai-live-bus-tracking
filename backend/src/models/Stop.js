const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
    stopId: {
        type: String,
        required: true,
        unique: true
    },
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    routeId: {
        type: String,
        required: true,
        index: true
    },
    stopName: {
        type: String,
        required: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    order: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Stop', stopSchema);
