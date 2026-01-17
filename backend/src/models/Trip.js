const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
    tripId: {
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
    busId: {
        type: String,
        required: true,
        index: true
    },
    driverUserId: {
        type: String,
        required: true
    },
    routeId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['RUNNING', 'ENDED'],
        default: 'RUNNING'
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: Date
}, {
    timestamps: true
});

module.exports = mongoose.model('Trip', tripSchema);
