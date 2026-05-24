'use strict';

// load settings from .env first
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const Log = require('./models/log');

const app = express();

// tell express to understand json
app.use(express.json());

// pino for printing log messages
const logger = pino({ level: 'info' });

// connect to the cloud database using the link in .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error(err, 'MongoDB connection error'));

/*
 * this runs before every request.
 * it saves a record of every visit to the database.
 * every process does this - its required by the project.
 */
app.use(async (req, res, next) => {
    try {
        // print it to the console
        logger.info({ method: req.method, url: req.url }, 'Request received');

        // save it to mongodb
        const requestLog = new Log({
            level: 'info',
            message: `${req.method} ${req.url}`,
            timestamp: new Date(),
            endpoint: req.url,
            method: req.method
        });
        await requestLog.save();
    } catch (err) {
        // if logging broke, thats fine, keep going
        logger.error(err, 'Failed to save request log');
    }
    next();
});

// GET /api/about - gives back the names of the people who made this project
app.get('/api/about', async (req, res) => {
    try {
        // save a log that someone asked about the team
        logger.info('/api/about endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: 'GET /api/about endpoint accessed',
            timestamp: new Date(),
            endpoint: '/api/about',
            method: 'GET'
        });
        await accessLog.save();

        // we read the names from .env instead of the database
        // the project says we cant store developer names in the db, so we put them in .env instead
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

// only start the server if this file was run directly
if (require.main === module) {
    const port = process.env.PORT || 3004;
    app.listen(port, () => {
        logger.info(`About service running on port ${port}`);
    });
}

module.exports = app;
