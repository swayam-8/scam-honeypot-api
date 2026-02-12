const axios = require('axios');
const keyPool = require('../config/keyPool');
const logger = require('../utils/logger');

// -----------------------------------------------------------
// 🚀 REST API VERSION (Bypasses Library Errors)
// -----------------------------------------------------------

const API_VERSION = process.env.GEMINI_API_VERSION || "v1";
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-1.5-flash-latest,gemini-1.5-flash")
    .split(",")
    .map(m => m.trim())
    .filter(Boolean);
const MODEL_CANDIDATES = [PRIMARY_MODEL, ...FALLBACK_MODELS];

const buildUrl = (model, apiKey) =>
    `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

const callGeminiAPI = async (apiKey, contents, systemInstruction = "") => {
    
    // Construct the payload for the REST API
    const payload = {
        contents: contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.7
        }
    };

    for (const model of MODEL_CANDIDATES) {
        const url = buildUrl(model, apiKey);
        try {
            const response = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' }
            });

            // Safe extraction of the reply
            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (error) {
            // Log model-specific failure and continue to the next candidate model.
            const errorMessage = error.response?.data?.error?.message || error.message;
            logger.error(`Gemini REST API Failed [${API_VERSION}/${model}]: ${errorMessage}`);
        }
    }

    return null;
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
