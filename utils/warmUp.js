const { GoogleGenerativeAI } = require('@google/generative-ai');
const keyPool = require('../config/keyPool');
const logger = require('./logger');

module.exports = async () => {
    logger.info("Warming up keys...");

    try {
        const keys = keyPool.getAllKeys().slice(0, 5);
        const apiVersion = process.env.GEMINI_API_VERSION || "v1";
        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

        const promises = keys.map(async (key) => {
            try {
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel(
                    { model: modelName },
                    { apiVersion }
                );
                await model.generateContent("ping");
            } catch (err) {
                // Ignore per-key warmup errors so startup remains resilient.
            }
        });

        await Promise.all(promises);
        logger.success("Keys Ready.");
    } catch (error) {
        logger.error(`Warmup failed (System): ${error.message}`);
    }
};
