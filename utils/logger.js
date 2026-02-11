const fs = require('fs');
const path = require('path');

// Create a write stream to save logs to a file (non-blocking)
const logFilePath = path.join(__dirname, '../audit.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const getTimestamp = () => new Date().toISOString();

const logger = {
    info: (message) => {
        const logMsg = `[INFO] [${getTimestamp()}] ${message}`;
        console.log(`\x1b[36m%s\x1b[0m`, logMsg); // Cyan for Info
        logStream.write(logMsg + '\n');
    },

    error: (message, error) => {
        const errorDetails = error ? ` | ${error.message || error}` : '';
        const logMsg = `[ERROR] [${getTimestamp()}] ${message}${errorDetails}`;
        console.error(`\x1b[31m%s\x1b[0m`, logMsg); // Red for Error
        logStream.write(logMsg + '\n');
    },

    warn: (message) => {
        const logMsg = `[WARN] [${getTimestamp()}] ${message}`;
        console.warn(`\x1b[33m%s\x1b[0m`, logMsg); // Yellow for Warning
        logStream.write(logMsg + '\n');
    },

    success: (message) => {
        const logMsg = `[SUCCESS] [${getTimestamp()}] ${message}`;
        console.log(`\x1b[32m%s\x1b[0m`, logMsg); // Green for Success
        logStream.write(logMsg + '\n');
    }
};

module.exports = logger;