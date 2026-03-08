const axios = require('axios');

async function testLogin() {
    try {
        const res = await axios.post('https://prasaicollegeportal.vercel.app/api/auth/login', {
            email: 'nonexistent@test.com',
            password: 'password',
            orgSlug: 'testcollege'
        });
        console.log('Success:', res.data);
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}
testLogin();
