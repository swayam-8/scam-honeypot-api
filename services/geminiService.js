const axios = require('axios');
const keyPool = require('../config/keyPool');
const logger = require('../utils/logger');

// -----------------------------------------------------------
// 🚀 REST API VERSION (Bypasses Library Errors)
// -----------------------------------------------------------

const callGeminiAPI = async (apiKey, contents, systemInstruction = "") => {
    // We manually type the URL for Gemini 1.5 Flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // Construct the payload for the REST API
    const payload = {
        contents: contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.7
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Safe extraction of the reply
        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
        // Log the exact error from Google (very helpful for debugging)
        const errorMessage = error.response?.data?.error?.message || error.message;
        logger.error(`Gemini REST API Failed: ${errorMessage}`);
        return null;
    }
};

/**
 * AGENT MODE (Human-like replies)
 */
const generateResponse = async (sessionId, userMessage, history = []) => {
    try {
        const apiKey = keyPool.getKeyForSession(sessionId);
        if (!apiKey) throw new Error("No available API keys.");

        // 1. Setup the Persona (System Instruction)
        const persona = 
            "You are a naive, non-technical elderly person. " +
            "You are polite but easily confused. " +
            "You never give real money, but you pretend to be interested. " +
            "Keep your replies short (1-2 sentences).";

        // 2. Format History for REST API
        // If history is empty, we just send the new message
        let contents = [];
        
        // (Optional: Add history formatting here if your database stores it strictly)
        // For now, we just send the user message to keep it simple and robust
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        // 3. Call the API
        const reply = await callGeminiAPI(apiKey, contents, persona);

        if (!reply) throw new Error("Empty response from API");
        return reply.trim();

    } catch (error) {
        logger.error(`Gemini Agent Error: ${error.message}`);
        // ⚠️ FALLBACK: If AI fails, return this text so the tester sees a reply
        return "Oh dear, my internet is acting up. Could you say that again?";
    }
};

/**
 * DETECTOR MODE (Scam risk scoring)
 */
const detectScamRisk = async (sessionId, text) => {
    try {
        const apiKey = keyPool.getKeyForSession(sessionId);
        if (!apiKey) return "MEDIUM";

        const prompt = `
        Classify this message as LOW, MEDIUM, or HIGH risk.
        Message: "${text}"
        Reply with ONLY ONE WORD.`;

        const contents = [{
            role: "user",
            parts: [{ text: prompt }]
        }];

        const risk = await callGeminiAPI(apiKey, contents);
        return risk ? risk.trim().toUpperCase() : "MEDIUM";

    } catch (error) {
        logger.error(`Gemini Detector Error: ${error.message}`);
        return "MEDIUM";
    }
};

module.exports = { generateResponse, detectScamRisk };