require('dotenv').config(); // Production Sync Commit
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const connectDB = require('./config/database');
const { db, initializationError } = require('./config/firebase'); // Firebase DB

const errorHandler = require('./middleware/errorHandler');

// Initialize App
const app = express();
const server = http.createServer(app);

// Connect Database
console.log("Firebase Mode: Database connection handled via Admin SDK");

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());

// Critical Error Check Middleware
app.use((req, res, next) => {
    if (initializationError) {
        console.error("Blocking request due to Init Error:", initializationError.message);
        return res.status(500).json({
            success: false,
            message: 'Server Configuration Error',
            error: `Firebase Init Failed: ${initializationError.message}`
        });
    }
    next();
});

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000, // Increased for dev/testing
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// Basic Route
app.get('/', (req, res) => {
    res.send('Multi-College Bus Tracking API Running');
});

// API Routes (to be imported)
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/owner', require('./routes/owner.routes'));
app.use('/api/admin/routes', require('./routes/bulkRoute.routes')); // Must be before collegeAdmin routes
app.use('/api/admin', require('./routes/collegeAdmin.routes'));
app.use('/api/driver', require('./routes/driver.routes'));
app.use('/api/student', require('./routes/student.routes'));
app.use('/api/geocode', require('./controllers/geocodeController').reverseGeocode);

// Error Handler
app.use(errorHandler);

// Init Socket.IO
// initSocket(server); // Disabled for Firebase Migration

// Start Server
// Start Server only if run directly
const PORT = process.env.PORT || 3001;
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
