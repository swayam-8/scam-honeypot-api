const axios = require('axios');
const keyPool = require('../config/keyPool');
const logger = require('../utils/logger');

const API_VERSION = process.env.GEMINI_API_VERSION || "v1";
const MAX_KEYS_TO_TRY = Number(process.env.GEMINI_MAX_KEYS_TO_TRY || 5);
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 5000);
const QUOTA_BACKOFF_MS = Number(process.env.GEMINI_QUOTA_BACKOFF_MS || 30 * 60 * 1000);
const MODELS = (
    process.env.GEMINI_MODELS ||
    (API_VERSION === "v1beta"
        ? "gemini-1.5-flash,gemini-1.5-pro,gemini-pro,gemini-1.0-pro"
        : "gemini-2.0-flash,gemini-2.0-flash-lite")
)
    .split(",")
    .map(model => model.trim())
    .filter(Boolean);

const quotaBackoffUntil = new Map();

const buildUrl = (model, apiKey) =>
    `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

const maskKey = (key) => {
    if (!key || key.length < 8) return "unknown";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

const isQuotaError = (message = "") =>
    /quota exceeded|resource_exhausted|limit:\s*0/i.test(message);

const isKeyInBackoff = (key) => {
    const until = quotaBackoffUntil.get(key);
    return typeof until === "number" && until > Date.now();
};

const markKeyInBackoff = (key, reason) => {
    quotaBackoffUntil.set(key, Date.now() + QUOTA_BACKOFF_MS);
    logger.warn(`Gemini key in backoff: ${maskKey(key)} | ${reason}`);
};

const getKeyCandidates = (sessionId) => {
    const primaryKey = keyPool.getKeyForSession(sessionId);
    const allKeys = keyPool.getAllKeys ? keyPool.getAllKeys() : [];
    const ordered = [primaryKey, ...allKeys.filter(key => key && key !== primaryKey)].filter(Boolean);
    const active = ordered.filter(key => !isKeyInBackoff(key));
    const selected = active.length > 0 ? active : ordered;
    return selected.slice(0, Math.max(1, MAX_KEYS_TO_TRY));
};

const callGeminiAPI = async (apiKey, contents) => {
    const payload = {
        contents,
        generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.7
        }
    };

    let quotaHit = false;
    let lastError = "Unknown Gemini failure";

    for (const model of MODELS) {
        try {
            const response = await axios.post(buildUrl(model, apiKey), payload, {
                headers: { "Content-Type": "application/json" },
                timeout: REQUEST_TIMEOUT_MS
            });

            const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
                return { reply, quotaHit: false, lastError: null };
            }
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.error?.message || error.message;
            lastError = message;
            if (isQuotaError(message)) quotaHit = true;
            logger.warn(`Gemini model failed [${API_VERSION}/${model}] (${status || "no-status"}): ${message}`);
        }
    }

    return { reply: null, quotaHit, lastError };
};

const callGeminiWithFallbackKeys = async (sessionId, contents) => {
    const keys = getKeyCandidates(sessionId);
    if (keys.length === 0) {
        logger.error("Gemini REST API Failed: No API keys available.");
        return null;
    }

    for (const key of keys) {
        const result = await callGeminiAPI(key, contents);
        if (result.reply) return result.reply;
        if (result.quotaHit) markKeyInBackoff(key, result.lastError);
        logger.warn(`Gemini key failed, trying next key: ${maskKey(key)}`);
    }

    return null;
};

const generateResponse = async (sessionId, userMessage, history = []) => {
    try {
        const persona =
            "You are a naive, non-technical elderly person. " +
            "You are polite but easily confused. " +
            "You never give real money, but you pretend to be interested. " +
            "Keep your replies short (1-2 sentences).";

        const trimmedHistory = Array.isArray(history) ? history.slice(-4) : [];
        const historyText = trimmedHistory
            .map(msg => `${msg.role === "model" ? "ASSISTANT" : "USER"}: ${msg.parts?.[0]?.text || ""}`)
            .join("\n");

        const prompt =
            `SYSTEM ROLE:\n${persona}\n\n` +
            (historyText ? `RECENT CHAT:\n${historyText}\n\n` : "") +
            `USER MESSAGE:\n${userMessage}\n\n` +
            "Reply naturally in 1-2 short sentences.";

        const contents = [{
            role: "user",
            parts: [{ text: prompt }]
        }];

        const reply = await callGeminiWithFallbackKeys(sessionId, contents);
        if (!reply) throw new Error("All Gemini models or keys failed.");
        return reply.trim();
    } catch (error) {
        logger.error(`Gemini Agent Error: ${error.message}`);
        return "Oh dear, my internet is acting up. Could you say that again?";
    }
};

const detectScamRisk = async (sessionId, text) => {
    try {
        const prompt = `Classify this message as LOW, MEDIUM, or HIGH risk. Message: "${text}". Reply with ONLY ONE WORD.`;
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
