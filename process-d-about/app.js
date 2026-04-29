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
        // Do not block the request if logging fails
        logger.error(err, 'Failed to save request log');
    }
    next();
});

// GET /api/about — returns the names of the development team members
app.get('/api/about', async (req, res) => {
    try {
        // Record that this specific endpoint was accessed
        logger.info('/api/about endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: 'GET /api/about endpoint accessed',
            timestamp: new Date(),
            endpoint: '/api/about',
            method: 'GET'
        });
        await accessLog.save();

        // Build the team member list by reading names from environment variables.
        // Names are stored in .env (not the database) as required by the project spec.
        const members = [];
        let i = 1;
        while (process.env[`TEAM_MEMBER_${i}_FIRST_NAME`]) {
            members.push({
                first_name: process.env[`TEAM_MEMBER_${i}_FIRST_NAME`],
                last_name: process.env[`TEAM_MEMBER_${i}_LAST_NAME`]
            });
            i++;
        }

        res.json(members);
    } catch (err) {
        logger.error(err, 'Error fetching team info');
        res.status(500).json({ id: 'GET_ABOUT_ERROR', message: err.message });
    }
});

// Only start listening for connections when this file is run directly, not during tests
if (require.main === module) {
    const PORT = process.env.PORT || 3004;
    app.listen(PORT, () => {
        logger.info(`About service running on port ${PORT}`);
    });
}

module.exports = app;
