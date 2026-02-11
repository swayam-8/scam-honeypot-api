const axios = require('axios');

exports.sendReport = async (data) => {
    const payload = {
        sessionId: data.sessionId,
        scamDetected: data.scamDetected,
        totalMessagesExchanged: data.totalMessages,
        extractedIntelligence: data.intelligence,
        agentNotes: data.notes || "Automated scam engagement completed."
    };

    try {
        await axios.post('https://hackathon.guvi.in/api/updateHoneyPotFinalResult', payload, {
            timeout: 3000 // 3s timeout
        });
        console.log("✅ GUVI Callback Sent Successfully");
    } catch (error) {
        console.error("❌ GUVI Callback Failed:", error.message);
        // We log it but don't crash, the session will still be cleaned up
    }
};