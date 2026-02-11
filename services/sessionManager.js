const Session = require('../models/Session');
const keyPool = require('../config/keyPool');
const geminiService = require('./geminiService');
const intelligenceService = require('./intelligenceService');
const guviCallback = require('./guviCallback');
const logger = require('../utils/logger'); // Using your new logger

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
            history: [],
            intel: { bankAccounts: [], upiIds: [], phishingLinks: [], phoneNumbers: [], suspiciousKeywords: [] },
            messageCount: 0,
            scamDetected: false
        };
        activeSessions.set(sessionId, session);
        
        // Async Backup to MongoDB with TIMER START
        // We don't await this to ensure <2s response time
        Session.create({ 
            sessionId, 
            geminiKey: assignedKey,
            lastActive: new Date() // Start the 30-min TTL timer
        }).catch(e => logger.error("Mongo Save Error", e));

    } else {
        // --- EXISTING SESSION ---
        // Background Update: Reset the TTL timer in MongoDB
        Session.updateOne(
            { sessionId }, 
            { $set: { lastActive: new Date() } }
        ).exec().catch(e => logger.warn(`Failed to update timer for ${sessionId}`));
    }

    // 2. Extract Intelligence (Regex)
    const newIntel = intelligenceService.scan(incomingText);
    session.intel = intelligenceService.mergeIntel(session.intel, newIntel);
    session.messageCount++;

    // 3. AI Execution (Scam Detect + Reply)
    const aiResponse = await geminiService.generateResponse(
        incomingText, 
        session.geminiKey, 
        conversationHistory 
    );

    // 4. Check Termination Conditions
    const isScam = aiResponse.riskLevel === "HIGH" || aiResponse.riskLevel === "DEFINITE";
    const isDone = session.messageCount >= 10 || isScam;

    if (isDone) {
        // 🔥 MANDATORY FINAL STEP
        logger.info(`[ENDING] Session ${sessionId} - Scam Detected. Sending Callback...`);
        
        try {
            await guviCallback.sendReport({
                sessionId,
                scamDetected: isScam,
                totalMessages: session.messageCount,
                intelligence: session.intel,
                notes: aiResponse.reasoning
            });

            // 🧹 IMMEDIATE CLEANUP (Delete Evidence)
            activeSessions.delete(sessionId);
            keyPool.releaseKey(session.geminiKey);
            
            await Session.deleteOne({ sessionId }); // Hard Delete from DB
            logger.success(`[CLEANUP] Session ${sessionId} destroyed immediately.`);

        } catch (err) {
            logger.error(`[CALLBACK FAILED] Could not report session ${sessionId}`, err);
            // We DO NOT delete if callback fails, so we can retry later manually.
            // The TTL index will eventually clean it up if we forget.
        }
    }

    return {
        status: "success",
        reply: aiResponse.reply
    };
};