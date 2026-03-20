// Import required packages
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const twilio = require('twilio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Validate required environment variables at startup
const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'GOOGLE_MAPS_API_KEY'];
for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

// Create a new Twilio client
const client = new twilio(accountSid, authToken);

// Create an Express app
const app = express();
const port = process.env.PORT || 3000;

// In-memory storage for user requests (replace with a database in a real application)
let userRequests = [];

// CORS - only allow requests from your own domain
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
}));

// Rate limiting - max 10 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Middleware to parse JSON bodies (limit size to prevent abuse)
app.use(express.json({ limit: '10kb' }));

// Add a route for the root path '/'
app.get('/', (req, res) => {
    res.send('Welcome to the Commute Time Notification API!');
});

// Route to handle setting up a notification
app.post('/api/setNotification', (req, res, next) => {
    try {
        const { start, end, threshold, phoneNumber } = req.body;

        // Validate required fields
        if (!start || !end || !threshold || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Validate phone number format (E.164 format: +1XXXXXXXXXX)
        const phoneRegex = /^\+[1-9]\d{7,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number. Use E.164 format (e.g. +13051234567)' });
        }

        // Validate threshold is a positive number
        const thresholdNum = Number(threshold);
        if (isNaN(thresholdNum) || thresholdNum <= 0) {
            return res.status(400).json({ success: false, message: 'Threshold must be a positive number' });
        }

        userRequests.push({ start, end, threshold: thresholdNum, phoneNumber });
        console.log('Notification request received:', { start, end, threshold: thresholdNum, phoneNumber });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Function to check commute time and send a notification if below the threshold
async function checkCommuteTime() {
    for (let request of userRequests) {
        const { start, end, threshold, phoneNumber } = request;
        try {
            const response = await axios.get(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&key=${googleMapsApiKey}`,
                { timeout: 10000 }
            );

            if (!response.data.routes || response.data.routes.length === 0) {
                throw new Error(`No routes found between ${start} and ${end}`);
            }

            const durationInMinutes = response.data.routes[0].legs[0].duration.value / 60;

            if (durationInMinutes <= threshold) {
                const message = await client.messages.create({
                    body: `Good news! Your commute from ${start} to ${end} is now ${Math.round(durationInMinutes)} minutes, below your threshold of ${threshold} minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phoneNumber
                });
                console.log(`Text sent to ${phoneNumber}, SID: ${message.sid}`);
            }
        } catch (error) {
            console.error(`Failed to check commute or send text: ${error.message}`);
        }
    }
}

// Set up an interval to check commute times every 5 minutes
setInterval(checkCommuteTime, 300000);

// Handle undefined routes (404)
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
