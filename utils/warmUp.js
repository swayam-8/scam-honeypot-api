const { GoogleGenerativeAI } = require('@google/generative-ai');
const keyPool = require('../config/keyPool');
const logger = require('./logger');

module.exports = async () => {
    logger.info("🔥 Warming up keys...");

    try {
        // Get first 5 keys to test (requires the getAllKeys fix we did earlier)
        const keys = keyPool.getAllKeys().slice(0, 5); 

        const promises = keys.map(async (key) => {
            try {
                const genAI = new GoogleGenerativeAI(key);
                
                // ⚠️ FIX: Using v1beta for Gemini 1.5 Flash
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash" 
                }, { 
                    apiVersion: "v1beta" 
                });

                // Send a tiny request to wake up the connection
                await model.generateContent("ping");
            } catch (err) {
                // If one key fails, just ignore it so the server still starts
                // logger.warn(`Warmup failed for a key: ${err.message}`);
            }
        });

        await Promise.all(promises);
        logger.success("✅ Keys Ready.");
    } catch (error) {
        logger.error(`❌ Warmup failed (System): ${error.message}`);
    }
};