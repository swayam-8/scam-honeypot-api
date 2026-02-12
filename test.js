require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const API_SECRET_KEY = process.env.TEST_API_SECRET_KEY || process.env.API_SECRET_KEY || '';

const headers = API_SECRET_KEY ? { 'x-api-key': API_SECRET_KEY } : {};

const run = async () => {
  console.log(`Testing API at: ${BASE_URL}`);

  try {
    const health = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('\n[HEALTH] OK');
    console.log(`Status: ${health.status}`);
    console.log('Body:', health.data);
  } catch (error) {
    const status = error.response?.status;
    const body = error.response?.data;
    console.log('\n[HEALTH] FAILED');
    console.log('Error:', status ? `${status}` : (error.code || error.message));
    if (body) console.log('Body:', body);
  }

  const payload = {
    sessionId: `test-session-${Date.now()}`,
    message: {
      text: 'URGENT: Verify your bank account and OTP now.'
    },
    conversationHistory: []
  };

  try {
    const honeypot = await axios.post(`${BASE_URL}/api/honeypot`, payload, {
      headers,
      timeout: 7000
    });

    console.log('\n[HONEYPOT] OK');
    console.log(`Status: ${honeypot.status}`);
    console.log('Body:', honeypot.data);
  } catch (error) {
    const status = error.response?.status;
    const body = error.response?.data;
    console.log('\n[HONEYPOT] FAILED');
    console.log('Error:', status ? `${status}` : (error.code || error.message));
    if (body) console.log('Body:', body);
  }
};

run();
