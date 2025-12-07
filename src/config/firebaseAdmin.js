const admin = require('firebase-admin');

// Decode base64 encoded service account key from environment variable
let serviceAccount;

try {
  if (process.env.FB_SERVICE_KEY) {
    // Decode from base64 to utf8 string
    const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
    // Parse the JSON string
    serviceAccount = JSON.parse(decoded);
  } else {
    console.warn('FB_SERVICE_KEY not found in environment variables');
  }
} catch (error) {
  console.error('Error decoding Firebase service account key:', error.message);
  throw new Error('Failed to decode Firebase service account key');
}

// Initialize Firebase Admin SDK
if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    throw error;
  }
}

module.exports = admin;

