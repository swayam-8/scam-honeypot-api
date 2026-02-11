// Load all keys into an array
const allKeys = [];
for (let i = 1; i <= 50; i++) {
    const key = process.env[`GEMINI_KEY_${i}`];
    if (key) allKeys.push(key);
}

console.log(`[INIT] Loaded ${allKeys.length} Gemini Keys.`);

// Maps SessionID -> Key (Locking mechanism)
const sessionAssignments = new Map();

module.exports = {
    getKeyForSession: (sessionId) => {
        // Return existing key if locked
        if (sessionAssignments.has(sessionId)) {
            return sessionAssignments.get(sessionId);
        }
        
        // Assign random key for new session (Load Balancing)
        const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        sessionAssignments.set(sessionId, randomKey);
        return randomKey;
    },
    
    releaseKey: (sessionId) => {
        sessionAssignments.delete(sessionId);
    },
    
    getAllKeys: () => allKeys
};