// Import required packages
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const twilio = require('twilio');

// Load environment variables from .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

// Create a new Twilio client using the environment variables
const client = new twilio(accountSid, authToken);

// Create an Express app
const app = express();
const port = 3000;

// In-memory storage for user requests (replace with a database in a real application)
let userRequests = [];

// Middleware to parse JSON bodies
app.use(express.json());

// Add a route for the root path '/'
app.get('/', (req, res) => {
    res.send('Welcome to the Commute Time Notification API!');
});

// Route to handle setting up a notification
app.post('/api/setNotification', (req, res, next) => {
    try {
        const { start, end, threshold, phoneNumber } = req.body;

        // Validate input
        if (!start || !end || !threshold || !phoneNumber) {
            throw new Error('Missing required fields');
        }

        // Store user request data (replace with database storage in a real app)
        userRequests.push({ start, end, threshold, phoneNumber });

        console.log('Notification request received:', { start, end, threshold, phoneNumber });

        res.json({ success: true });
    } catch (error) {
        next(error); // Pass the error to the global error handler
    }
});

// Function to check commute time and send a notification if below the threshold
async function checkCommuteTime() {
    for (let request of userRequests) {
        const { start, end, threshold, phoneNumber } = request;
        try {
            // Make a request to the Google Maps Directions API
            const response = await axios.get(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&key=${googleMapsApiKey}`
            );

            // Check if the response has any routes
            if (response.data.routes.length === 0) {
                throw new Error(`No routes found between ${start} and ${end}`);
            }

            // Calculate the duration in minutes
            const durationInMinutes = response.data.routes[0].legs[0].duration.value / 60;

            // Check if the commute time is below the user-defined threshold
            if (durationInMinutes <= threshold) {
                // Send a text message using Twilio
                await client.messages.create({
                    body: `Good news! Your commute time from ${start} to ${end} is now ${Math.round(durationInMinutes)} minutes, which is below your set threshold of ${threshold} minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phoneNumber
                });
                console.log(`Text sent to ${phoneNumber}`);
            }
        } catch (error) {
            console.error(`Failed to get directions or send text: ${error.message}`);
            // Optionally, you can pass the error to the next function for global handling
            // next(error);
        }
    }
}

// Set up an interval to check commute times every 5 minutes
setInterval(checkCommuteTime, 300000); // 300000 ms = 5 minutes

// Handle undefined routes (404)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack trace for debugging
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
