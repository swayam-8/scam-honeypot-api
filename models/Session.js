const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    geminiKey: { type: String, required: true },
    
    // Store the chat history & intelligence
    history: { type: Array, default: [] },
    intel: { type: Object, default: {} },
    messageCount: { type: Number, default: 0 },
    
    // ⚠️ The Magic Field: Updates every time the user sends a message
    lastActive: { type: Date, default: Date.now }
});

// ⚠️ TTL INDEX: Automatically delete this document 30 minutes (1800 seconds) 
// after the 'lastActive' time.
SessionSchema.index({ lastActive: 1 }, { expireAfterSeconds: 1800 });

module.exports = mongoose.model('Session', SessionSchema);