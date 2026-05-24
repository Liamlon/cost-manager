'use strict';

// load the secret settings from the .env file before anything else
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const Log = require('./models/log');

const app = express();

// this makes express understand json that gets sent to it
app.use(express.json());

// pino is used to print log messages, "info" means normal stuff not errors
const logger = pino({ level: 'info' });

// connect to the cloud database using the link stored in .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error(err, 'MongoDB connection error'));

/*
 * this part runs every single time someone sends any request to this server.
 * it saves a record to the database so we always know what happened.
 * think of it like a diary that writes itself every time someone knocks on the door.
 */
app.use(async (req, res, next) => {
    try {
        // print to the console so we can see requests coming in
        logger.info({ method: req.method, url: req.url }, 'Request received');

        // save the request to mongodb too so we have a permanent copy
        const requestLog = new Log({
            level: 'info',
            message: `${req.method} ${req.url}`,
            timestamp: new Date(),
            endpoint: req.url,
            method: req.method
        });
        await requestLog.save();
    } catch (err) {
        // if saving the log failed thats ok, we still let the request go through
        logger.error(err, 'Failed to save request log to database');
    }
    next();
});

// GET /api/logs - when someone wants to see all the logs, grab everything from the database
app.get('/api/logs', async (req, res) => {
    try {
        // save a log saying this endpoint was visited
        logger.info('/api/logs endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: 'GET /api/logs endpoint accessed',
            timestamp: new Date(),
            endpoint: '/api/logs',
            method: 'GET'
        });
        await accessLog.save();

        // get every single log from the database and send them all back
        const logs = await Log.find({});
        res.json(logs);
    } catch (err) {
        logger.error(err, 'Error fetching logs from database');
        res.status(500).json({ id: 'GET_LOGS_ERROR', message: err.message });
    }
});

// only turn on the server if this file was run directly, not during tests
if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        logger.info(`Logs service running on port ${port}`);
    });
}

module.exports = app;
