const { GoogleGenerativeAI } = require('@google/generative-ai');
const keyPool = require('../config/keyPool');
const logger = require('../utils/logger');

/**
 * ------------------------------
 * AGENT MODE (Human-like replies)
 * ------------------------------
 */
const generateResponse = async (sessionId, userMessage, history = []) => {
  try {
    const apiKey = keyPool.getKeyForSession(sessionId);
    if (!apiKey) throw new Error("No available API keys.");

    const genAI = new GoogleGenerativeAI(apiKey);

    // ✅ FORCE v1beta (required for gemini-1.5-flash)
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1beta" }
    );

    const chat = model.startChat({
      history: Array.isArray(history) ? history : [],
      generationConfig: {
        maxOutputTokens: 80,
        temperature: 0.6,
      },
    });

    const personaPrompt =
      "You are a naive, non-technical elderly person. " +
      "You are very polite but easily confused. " +
      "You trust people and ask simple clarifying questions. " +
      "You never give real money or passwords, but pretend you might. " +
      "Keep replies under 2 sentences and conversational.\n\n";

    const result = await chat.sendMessage(personaPrompt + userMessage);

    const response =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!response) {
      throw new Error("Empty Gemini agent response");
    }

    return response.trim();

  } catch (error) {
    logger.error(`Gemini Agent Error: ${error.stack || error.message}`);
    return "Oh dear, my internet seems slow. Could you please say that again?";
  }
};

/**
 * --------------------------------
 * DETECTOR MODE (Scam risk scoring)
 * --------------------------------
 */
const detectScamRisk = async (sessionId, text) => {
  try {
    const apiKey = keyPool.getKeyForSession(sessionId);
    if (!apiKey) throw new Error("No available API keys.");

    const genAI = new GoogleGenerativeAI(apiKey);

    // ✅ FORCE v1beta here too
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1beta" }
    );

    const prompt = `
Classify the following message into one category:

LOW – normal / harmless
MEDIUM – suspicious or scam-like
HIGH – clear scam or fraud attempt

Message:
"${text}"

Respond with ONLY ONE WORD:
LOW, MEDIUM, or HIGH
`;

    const result = await model.generateContent(prompt);

    const risk =
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!risk) throw new Error("Empty risk classification");

    return risk.trim().toUpperCase();

  } catch (error) {
    logger.error(`Gemini Detector Error: ${error.stack || error.message}`);
    // Fail-safe: treat as suspicious
    return "MEDIUM";
  }
};

module.exports = {
  generateResponse,
  detectScamRisk
};
