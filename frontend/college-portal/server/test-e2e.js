const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFullFlow() {
    try {
        const timestamp = Date.now();
        const rand = Math.floor(Math.random() * 1000);

        // 0. Register Owner
        console.log("Registering owner...");
        const ownerLogin = await axios.post(`${API_URL}/auth/register-owner`, {
            name: "Test Owner",
            email: `owner${timestamp}@test.com`,
            password: "password"
        });
        const ownerToken = ownerLogin.data.token;
        console.log("Owner Logged In");

        // 1. Create a college
        console.log("Creating college...");
        const slug = `testcoll${rand}`;
        const facultyEmail = `faculty${timestamp}@test.com`;

        const createColRes = await axios.post(`${API_URL}/owner/colleges`, {
            collegeName: "Test College XYZ",
            branch: "Main",
            address: "123 Test St",
            slug: slug,
            facultyName: "Test Faculty",
            facultyEmail: facultyEmail,
            password: "password123",
            phone: "1234567890"
        }, {
            headers: { Authorization: `Bearer ${ownerToken}` }
        });
        console.log("College Created");

        // Login as faculty to get token
        console.log("Logging in as faculty...");
        const adminLogin = await axios.post(`${API_URL}/auth/login`, {
            email: facultyEmail,
            password: "password123",
            orgSlug: slug
        });
        const token = adminLogin.data.token;
        console.log("Admin Logged In:", !!adminLogin.data.firebaseCustomToken);

        // 2. Create Student
        console.log("Creating student...");
        const studentEmail = `student${timestamp}@test.com`;
        const addStudent = await axios.post(`${API_URL}/admin/students`, {
            name: "Student One",
            registerNumber: "REG" + timestamp,
            rollNumber: "1",
            email: studentEmail,
            phone: "0987654321"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Student Created");

        // 3. Login Student
        console.log("Logging in student...");
        const studentLogin = await axios.post(`${API_URL}/auth/login`, {
            email: studentEmail,
            password: "REG" + timestamp,
            orgSlug: slug
        });
        console.log("Student Logged In. Custom Token exists:", !!studentLogin.data.firebaseCustomToken);
        console.log("SUCCESS!");

    } catch (e) {
        if (e.response) {
            console.error("Error at step:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error:", e.message);
        }
    }
}
testFullFlow();
