const { GoogleGenerativeAI } = require("@google/generative-ai");
const scamPrompt = require('../prompts/scamDetector');
const agentPrompt = require('../prompts/agentPersona');

exports.generateResponse = async (userText, apiKey, history) => {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Construct Prompt: System Instructions + History + New Message
        // We combine Detection and Reply into one call for speed (0.8s)
        const fullPrompt = `
        ${scamPrompt}
        ${agentPrompt}
        
        CONVERSATION HISTORY:
        ${JSON.stringify(history)}
        
        NEW MESSAGE:
        "${userText}"
        
        TASK:
        1. Analyze if this is a scam (Low/Medium/High/Definite).
        2. Generate a naive victim reply.
        
        OUTPUT JSON FORMAT ONLY:
        { "riskLevel": "...", "reply": "...", "reasoning": "..." }
        `;

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();
        
        // Parse JSON safely
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Gemini Error:", error.message);
        return { riskLevel: "LOW", reply: "I'm not sure I understand, can you explain?", reasoning: "Error" };
    }
};