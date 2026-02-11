const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Error:", err.message);
        // Don't exit process, try to survive using in-memory only
    }
};

module.exports = connectDB;