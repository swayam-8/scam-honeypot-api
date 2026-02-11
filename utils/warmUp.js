const keyPool = require('../config/keyPool');
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async () => {
    console.log("🔥 Warming up keys...");
    const keys = keyPool.getAllKeys().slice(0, 5); // Warm up first 5 to start
    
    const promises = keys.map(async (key) => {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            await model.generateContent("Hi");
        } catch (e) { console.log("Warmup error (minor):", e.message); }
    });

    await Promise.all(promises);
    console.log("✅ Keys Ready.");
};