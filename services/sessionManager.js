const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const geminiService = require('./geminiService');
const intelligenceService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger');

// In-Memory Speed Layer (The "Thread")
const activeSessions = new Map();

exports.processRequest = async (payload) => {
    const { sessionId, message, conversationHistory } = payload;
    const incomingText = message.text || "";

    // 1. Get or Initialize Session
    let session = activeSessions.get(sessionId);

    if (!session) {
        // --- NEW SESSION ---
        const assignedKey = keyPool.getKeyForSession(sessionId);

        session = {
            sessionId,
            geminiKey: assignedKey,
            intel: {
                bankAccounts: [],
                upiIds: [],
                phishingLinks: [],
                phoneNumbers: [],
                suspiciousKeywords: []
            },
            messageCount: 0,
            scamDetected: false
        };

        activeSessions.set(sessionId, session);

        // Async Backup to MongoDB (do not await for speed)
        Session.create({
            sessionId,
            geminiKey: assignedKey,
            lastActive: new Date()
        }).catch(e => logger.error("Mongo Save Error", e));

    } else {
        // --- EXISTING SESSION ---
        Session.updateOne(
            { sessionId },
            { $set: { lastActive: new Date() } }
        ).exec().catch(() =>
            logger.warn(`Failed to update timer for ${sessionId}`)
        );
    }

    // 2. Extract Intelligence (Regex-based)
    const newIntel = intelligenceService.scan(incomingText);
    session.intel = intelligenceService.mergeIntel(session.intel, newIntel);
    session.messageCount++;

    // 3. Scam Detection (Gemini DETECTOR MODE)
    const riskLevel = await geminiService.detectScamRisk(
        sessionId,
        incomingText
    );

    // 4. If LOW risk → simple safe reply (no agent)
    if (riskLevel === "LOW") {
        return {};
    }

    // 5. Convert conversationHistory → Gemini format
    const formattedHistory = (conversationHistory || []).map(m => ({
        role: m.sender === "scammer" ? "user" : "model",
        parts: [ { text: m.text } ]
    }));

    // 6. Activate AI Agent (Gemini AGENT MODE)
    const aiText = await geminiService.generateResponse(
        sessionId,
        incomingText,
        formattedHistory
    );

    // 7. Decide termination
    const isScam =
        riskLevel === "HIGH" &&
        (
            session.intel.upiIds.length > 0 ||
            session.intel.bankAccounts.length > 0 ||
            session.intel.phishingLinks.length > 0
        );

    const isDone = session.messageCount >= 10 || isScam;

    if (isDone) {
        logger.info(`[ENDING] Session ${sessionId} completed. Sending GUVI callback...`);

        try {
            await guviCallback.sendReport({
                sessionId,
                scamDetected: isScam,
                totalMessagesExchanged: session.messageCount,
                extractedIntelligence: session.intel,
                agentNotes: "Scammer used urgency and payment redirection tactics"
            });

            // Cleanup
            activeSessions.delete(sessionId);
            keyPool.releaseKey(sessionId);
            await Session.deleteOne({ sessionId });

            logger.success(`[CLEANUP] Session ${sessionId} destroyed`);

        } catch (err) {
            logger.error(`[CALLBACK FAILED] Session ${sessionId}`, err);
        }
    }

    // 8. API Response (as per spec)
    return {
        status: "success",
        reply: aiText
    };
};
