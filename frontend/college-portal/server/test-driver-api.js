const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');

const testDriverApi = async () => {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not found');

        // Create a test token for 'loki' (sist)
        const token = jwt.sign(
            { id: 'driver-1769049040241', role: 'DRIVER', collegeId: 'sist' },
            secret,
            { expiresIn: '1h' }
        );

        console.log('Testing with token for collegeId: sist');

        try {
            console.log('Checking Base URL...');
            const rootRes = await axios.get('http://localhost:3001/');
            console.log('Base URL Response:', rootRes.data);

            const response = await axios.get('http://localhost:3001/api/driver/buses', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            console.log('Response Status:', response.status);
            console.log('Response Data:', JSON.stringify(response.data, null, 2));
        } catch (err) {
            if (err.response) {
                console.error('API Error:', err.response.status, err.response.data);
            } else {
                console.error('Connection Error:', err.message);
            }
        }

    } catch (error) {
        console.error('Script Error:', error);
    }
};

testDriverApi();
