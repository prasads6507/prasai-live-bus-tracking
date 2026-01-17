const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    routeId: {
        type: String,
        required: true,
        unique: true
    },
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    routeName: {
        type: String,
        required: true
    },
    startPoint: String,
    endPoint: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Route', routeSchema);
