const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to DB");
    const count = await User.countDocuments({ role: 'patient' });
    console.log("Patient Count:", count);
    const users = await User.find({ role: 'patient' }).select('email firstName lastName role');
    console.log("Patients:", users);
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
