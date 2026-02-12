const axios = require('axios');

exports.sendReport = async (data) => {
    const payload = {
        sessionId: data.sessionId,
        scamDetected: data.scamDetected,
        totalMessagesExchanged: data.totalMessagesExchanged ?? data.totalMessages ?? 0,
        extractedIntelligence: data.extractedIntelligence ?? data.intelligence ?? {},
        agentNotes: data.agentNotes ?? data.notes ?? "Automated scam engagement completed."
    };

    try {
        await axios.post('https://hackathon.guvi.in/api/updateHoneyPotFinalResult', payload, {
            timeout: 3000
        });
        console.log("GUVI Callback Sent Successfully");
    } catch (error) {
        const status = error.response?.status;
        const details = error.response?.data;
        console.error(
            "GUVI Callback Failed:",
            status ? `${status} ${error.message}` : error.message,
            details || ""
        );
    }
};
