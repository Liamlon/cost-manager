'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const Log = require('./models/log');

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Create a Pino logger — it outputs structured JSON lines to the console
const logger = pino({ level: 'info' });

// Connect to the MongoDB Atlas database using the URI stored in .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error(err, 'MongoDB connection error'));

/*
 * Middleware: runs automatically before every HTTP request this server receives.
 * It fulfills the requirement to log every incoming request both to the console
 * (via Pino) and to the "logs" collection in MongoDB.
 */
app.use(async (req, res, next) => {
    try {
        // Log the incoming request to the console
        logger.info({ method: req.method, url: req.url }, 'Request received');

        // Save the request details as a new log entry in MongoDB
        const requestLog = new Log({
            level: 'info',
            message: `${req.method} ${req.url}`,
            timestamp: new Date(),
            endpoint: req.url,
            method: req.method
        });
        await requestLog.save();
    } catch (err) {
        // If logging fails, do not stop the request — just print the error
        logger.error(err, 'Failed to save request log to database');
    }
    next();
});

// GET /api/logs — retrieves all log entries from the database
app.get('/api/logs', async (req, res) => {
    try {
        // Record that this specific endpoint was accessed (a second log entry per request)
        logger.info('/api/logs endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: 'GET /api/logs endpoint accessed',
            timestamp: new Date(),
            endpoint: '/api/logs',
            method: 'GET'
        });
        await accessLog.save();

        // Retrieve every log document from MongoDB and return them as JSON
        const logs = await Log.find({});
        res.json(logs);
    } catch (err) {
        logger.error(err, 'Error fetching logs from database');
        res.status(500).json({ id: 'GET_LOGS_ERROR', message: err.message });
    }
});

// Only start listening for connections when this file is run directly, not during tests
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        logger.info(`Logs service running on port ${PORT}`);
    });
}

module.exports = app;
