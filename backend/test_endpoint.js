const axios = require('axios');

async function test() {
    try {
        const res = await axios.patch('http://localhost:5001/api/patient/profile', 
            { firstName: 'Test' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer some_invalid_token'
                }
            }
        );
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
