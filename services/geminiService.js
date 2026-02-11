const { GoogleGenerativeAI } = require('@google/generative-ai');
const keyPool = require('../config/keyPool');
const logger = require('../utils/logger');

const generateResponse = async (sessionId, userMessage, history) => {
    try {
        // 1. Get a key from the pool
        const apiKey = keyPool.getKeyForSession(sessionId);
        if (!apiKey) throw new Error("No available API keys.");

        const genAI = new GoogleGenerativeAI(apiKey);

        // 2. Configure the Model (FIXED: Uses v1beta)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are a naive, non-technical elderly person. You are very polite but easily confused. You trust people but ask many simple, clarifying questions. You never give away real money or passwords, but you pretend you are trying to. Keep your responses short (under 2 sentences) and conversational."
        }, { 
            apiVersion: "v1beta" 
        });

        // 3. Start Chat with History
        const chat = model.startChat({
            history: history || [],
            generationConfig: {
                maxOutputTokens: 100, // Keep replies fast
                temperature: 0.7,
            },
        });

        // 4. Send Message
        const result = await chat.sendMessage(userMessage);
        const response = result.response.text();

        return response;

    } catch (error) {
        logger.error(`Gemini Error: ${error.message}`);
        
        // Fallback if AI fails
        return "Oh dear, my internet is acting up. Could you say that one more time?";
    }
};

module.exports = { generateResponse };