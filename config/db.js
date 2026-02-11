const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // This command tells Node to grab the string from Render (or .env locally)
        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1); // Stop the app if DB fails
    }
};

module.exports = connectDB;