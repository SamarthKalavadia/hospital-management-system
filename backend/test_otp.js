const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('https://hospital-management-system-gbr9.onrender.com/api/auth/send-otp', { email: 'test@example.com' });
        console.log('Status:', res.status);
        console.log('Data:', res.data);
    } catch (e) {
        if (e.response) {
            console.log('Status:', e.response.status);
            console.log('Data:', e.response.data);
        } else {
            console.error('Error:', e.message);
        }
    }
}

test();
