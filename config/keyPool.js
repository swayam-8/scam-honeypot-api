// config/keyPool.js
const logger = require('../utils/logger');

class KeyPool {
    constructor() {
        this.keys = [];
        this.usedKeys = new Map(); // Tracks which key is assigned to which sessionId
        this.init();
    }

    init() {
        // Automatically find all keys from GEMINI_KEY_1 to GEMINI_KEY_50
        for (let i = 1; i <= 50; i++) {
            const key = process.env[`GEMINI_KEY_${i}`];
            if (key && key.trim() !== "") {
                this.keys.push(key);
            }
        }
        
        if (this.keys.length === 0) {
            logger.error("❌ No Gemini API keys found in .env!");
        } else {
            logger.success(`✅ Loaded ${this.keys.length} Gemini API keys into the pool.`);
        }
    }

    // Assigns a key to a session. If session exists, returns the same key.
    getKeyForSession(sessionId) {
        if (this.usedKeys.has(sessionId)) {
            return this.usedKeys.get(sessionId);
        }

        // Simple Round-Robin or Load Balancing
        // Pick a key that is least used or just pick one at random for the hackathon
        const key = this.keys[Math.floor(Math.random() * this.keys.length)];
        this.usedKeys.set(sessionId, key);
        return key;
    }

    // Frees up the mapping when a session is deleted
    releaseKey(sessionId) {
        this.usedKeys.delete(sessionId);
    }
}

module.exports = new KeyPool();