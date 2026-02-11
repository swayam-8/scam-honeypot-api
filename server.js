require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db'); 
const sessionManager = require('./services/sessionManager');
const warmUpKeys = require('./utils/warmUp');
const logger = require('./utils/logger'); 

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(bodyParser.json());

// 1. Circuit Breaker Middleware (Hard Timeout Protection)
app.use((req, res, next) => {
    res.setTimeout(4500, () => {
        logger.error(`[TIMEOUT] Request ${req.body.sessionId || 'unknown'} took too long.`);
        
        if (!res.headersSent) {
            res.status(200).json({ 
                status: "success", 
                reply: "I need to check my details, please wait a moment." 
            });
        }
    });
    next();
});

// --- 👇 NEW: Root Route (Fixes "Cannot GET /") 👇 ---
app.get('/', (req, res) => {
    res.send('✅ The Honeypot API is Running! (Send POST requests to /api/honeypot)');
});

// --- 👇 NEW: Health Check (For automated monitoring) 👇 ---
app.get('/health', (req, res) => {
    res.json({ 
        status: "active", 
        timestamp: new Date().toISOString() 
    });
});
// -------------------------------------------------------

// 2. Main Honeypot Route
app.post('/api/honeypot', async (req, res) => {
    try {
        // Security Check
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.API_SECRET_KEY) {
            logger.warn(`Unauthorized access attempt from IP: ${req.ip}`);
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Pass request to the "Brain"
        const result = await sessionManager.processRequest(req.body);
        
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