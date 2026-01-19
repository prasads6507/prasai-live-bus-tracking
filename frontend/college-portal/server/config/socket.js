const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join college room
        socket.on('join_college', (collegeId) => {
            if (collegeId) {
                socket.join(`college:${collegeId}`);
                console.log(`Socket ${socket.id} joined college:${collegeId}`);
            }
        });

        // Join bus room
        socket.on('join_bus', (data) => {
            if (data.collegeId && data.busId) {
                socket.join(`college:${data.collegeId}:bus:${data.busId}`);
            }
        });

        // Driver location update
        socket.on('driver:location', (data) => {
            // data: { collegeId, busId, tripId, lat, lng, speed }
            if (data.collegeId && data.busId) {
                // Broadcast to college room
                io.to(`college:${data.collegeId}`).emit('bus:location:update', {
                    ...data,
                    lastUpdatedAt: new Date()
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = { initSocket, getIO };
