const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
    collegeId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    collegeName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'SUSPENDED'],
        default: 'ACTIVE'
    },
    plan: {
        type: String,
        default: 'TRIAL'
    },
    address: String,
    contactEmail: String,
    contactPhone: String
}, {
    timestamps: true
});

module.exports = mongoose.model('College', collegeSchema);
