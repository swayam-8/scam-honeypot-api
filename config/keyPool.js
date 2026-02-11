const logger = require('../utils/logger');

class KeyPool {
    constructor() {
        this.keys = [];
        this.usedKeys = new Map(); 
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

    // --- 👇 THIS WAS MISSING. I ADDED IT NOW. 👇 ---
    getAllKeys() {
        return this.keys;
    }
    // ---------------------------------------------

    getKeyForSession(sessionId) {
        if (this.usedKeys.has(sessionId)) {
            return this.usedKeys.get(sessionId);
        }
        // Simple random load balancing
        const key = this.keys[Math.floor(Math.random() * this.keys.length)];
        this.usedKeys.set(sessionId, key);
        return key;
    }

    releaseKey(sessionId) {
        this.usedKeys.delete(sessionId);
    }
}

module.exports = new KeyPool();