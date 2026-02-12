const axios = require('axios');
const keyPool = require('../config/keyPool');
const logger = require('../utils/logger');

// -----------------------------------------------------------
// 🚀 REST API VERSION (Bypasses Library Errors)
// -----------------------------------------------------------

const API_VERSION = process.env.GEMINI_API_VERSION || "v1";
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.0-flash-lite")
    .split(",")
    .map(m => m.trim())
    .filter(Boolean);
const MODEL_CANDIDATES = [PRIMARY_MODEL, ...FALLBACK_MODELS];
const MAX_KEYS_TO_TRY = Number(process.env.GEMINI_MAX_KEYS_TO_TRY || 5);

const buildUrl = (model, apiKey) =>
    `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

const maskKey = (key) => {
    if (!key || key.length < 8) return "unknown";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

const getKeyCandidates = (sessionId) => {
    const primaryKey = keyPool.getKeyForSession(sessionId);
    const pool = keyPool.getAllKeys ? keyPool.getAllKeys() : [];
    const others = pool.filter(k => k && k !== primaryKey);
    const candidates = [primaryKey, ...others].filter(Boolean);
    return candidates.slice(0, Math.max(1, MAX_KEYS_TO_TRY));
};

const callGeminiAPI = async (apiKey, contents) => {
    
    // Construct the payload for the REST API
    const payload = {
        contents: contents,
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

const callGeminiWithFallbackKeys = async (sessionId, contents) => {
    const keys = getKeyCandidates(sessionId);
    if (keys.length === 0) {
        logger.error("Gemini REST API Failed: No API keys available.");
        return null;
    }

    for (const key of keys) {
        const reply = await callGeminiAPI(key, contents);
        if (reply) return reply;
        logger.warn(`Gemini key failed, trying next key: ${maskKey(key)}`);
    }

    return null;
};

/**
 * AGENT MODE (Human-like replies)
 */
const generateResponse = async (sessionId, userMessage, history = []) => {
    try {
        // 1. Setup the Persona (System Instruction)
        const persona = 
            "You are a naive, non-technical elderly person. " +
            "You are polite but easily confused. " +
            "You never give real money, but you pretend to be interested. " +
            "Keep your replies short (1-2 sentences).";

        // 2. Format request for REST API (persona included in text for compatibility)
        let contents = [];

        const promptWithPersona =
            `SYSTEM ROLE:\n${persona}\n\n` +
            `USER MESSAGE:\n${userMessage}\n\n` +
            `Reply naturally in 1-2 short sentences.`;

        contents.push({
            role: "user",
            parts: [{ text: promptWithPersona }]
        });

        // 3. Call the API
        const reply = await callGeminiWithFallbackKeys(sessionId, contents);

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
        const prompt = `
        Classify this message as LOW, MEDIUM, or HIGH risk.
        Message: "${text}"
        Reply with ONLY ONE WORD.`;

        const contents = [{
            role: "user",
            parts: [{ text: prompt }]
        }];

        const risk = await callGeminiWithFallbackKeys(sessionId, contents);
        return risk ? risk.trim().toUpperCase() : "MEDIUM";

    } catch (error) {
        logger.error(`Gemini Detector Error: ${error.message}`);
        return "MEDIUM";
    }
};

module.exports = { generateResponse, detectScamRisk };
