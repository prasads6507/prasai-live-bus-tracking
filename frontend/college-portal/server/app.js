require('dotenv').config(); // Production Sync Commit
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const connectDB = require('./config/database');
const { db } = require('./config/firebase'); // Firebase DB

const errorHandler = require('./middleware/errorHandler');

// Initialize App
const app = express();
const server = http.createServer(app);

// Connect Database
// connectDB(); // Disabled for Firebase Migration
console.log("Firebase Mode: Database connection handled via Admin SDK");

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
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
app.use('/api/admin', require('./routes/collegeAdmin.routes'));
app.use('/api/driver', require('./routes/driver.routes'));
app.use('/api/student', require('./routes/student.routes'));

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
