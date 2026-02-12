require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db'); 
const keyPool = require('./config/keyPool');
const sessionManager = require('./services/sessionManager');
const warmUpKeys = require('./utils/warmUp');
const logger = require('./utils/logger'); 

const app = express();

// ✅ UPDATE: Uses Render's port or defaults to 10000
const PORT = process.env.PORT || 10000;

// Middleware
app.use(bodyParser.json());

// 1. Circuit Breaker Middleware (Hard Timeout Protection)
app.use((req, res, next) => {
    res.setTimeout(4500, () => {
        logger.error(`[TIMEOUT] Request took too long.`);
        if (!res.headersSent) {
            res.status(200).json({ 
                status: "success", 
                reply: "I need to check my details, please wait a moment." 
            });
        }
    });
    next();
});

// --- 👇 Root Route (So you don't see "Cannot GET /") 👇 ---
app.get('/', (req, res) => {
    res.status(200).send('✅ Honeypot Server is Running! (Send POST requests to /api/honeypot)');
});

// --- 👇 Health Check Route 👇 ---
app.get('/health', (req, res) => {
    res.json({ 
        status: "active", 
        port: PORT,
        time: new Date().toISOString(),
        gemini: {
            apiVersion: process.env.GEMINI_API_VERSION || "v1",
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
            fallbackModels: process.env.GEMINI_FALLBACK_MODELS || "gemini-1.5-flash-latest,gemini-1.5-flash",
            keyCount: keyPool.getAllKeys().length
        }
    });
});

// 2. Main Honeypot Route
app.post('/api/honeypot', async (req, res) => {
    try {
        // Log the incoming message to PROVE it reached the server
        console.log("------------------------------------------------");
        console.log(`📩 RECEIVED: "${req.body.message?.text?.substring(0, 50)}..."`);

        // Security Check
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.API_SECRET_KEY) {
            logger.warn(`⛔ Unauthorized access attempt from IP: ${req.ip}`);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Pass request to the "Brain"
        const result = await sessionManager.processRequest(req.body);
        
        // Log the Reply to PROVE the AI generated it
        console.log(`🤖 AI REPLIED: "${result.reply?.substring(0, 50)}..."`);
        console.log("------------------------------------------------");

        // Send Response
        res.json(result);

    } catch (error) {
        logger.error("[CRASH PREVENTED]", error);
        res.status(200).json({ 
            status: "success", 
            reply: "I am having some network issues, can you say that again?" 
        });
    }
});

// 3. Start Server
const startServer = async () => {
    await connectDB();
    await warmUpKeys(); 
    
    app.listen(PORT, () => {
        logger.success(`🚀 Honeypot Active on Port ${PORT}`);
    });
};

startServer();
