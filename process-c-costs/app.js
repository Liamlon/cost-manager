'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const Cost = require('./models/cost');
const User = require('./models/user');
const Log = require('./models/log');
const Report = require('./models/report');

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// The five categories the system supports for grouping costs
const VALID_CATEGORIES = ['food', 'health', 'housing', 'sports', 'education'];

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

// POST /api/add — adds a new cost item to the database
app.post('/api/add', async (req, res) => {
    try {
        const { description, category, userid, sum, date } = req.body;

        // All four core fields are required — reject if any are missing
        if (!description || !category || userid === undefined || sum === undefined) {
            return res.status(400).json({
                id: 'MISSING_FIELDS',
                message: 'description, category, userid, and sum are all required'
            });
        }

        // The category must be one of the five supported values
        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({
                id: 'INVALID_CATEGORY',
                message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`
            });
        }

        // userid must be a valid number
        if (isNaN(parseInt(userid))) {
            return res.status(400).json({ id: 'INVALID_USERID', message: 'userid must be a valid number' });
        }

        // The user must already exist in the database before we can add a cost for them
        const user = await User.findOne({ id: parseInt(userid) });
        if (!user) {
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: `No user found with id ${userid}` });
        }

        // Determine the date/time stamp for this cost item
        let costDate = new Date();
        if (date) {
            costDate = new Date(date);

            // Reject the cost if the provided date string is not a valid date
            if (isNaN(costDate.getTime())) {
                return res.status(400).json({ id: 'INVALID_DATE', message: 'The date value provided is not valid' });
            }

            // The server does not accept cost items with dates from past months.
            // This restriction is what makes the Computed Design Pattern reliable:
            // a cached report for a past month can never be invalidated by a late addition.
            const now = new Date();
            const costYear = costDate.getFullYear();
            const costMonth = costDate.getMonth() + 1;
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            if (costYear < currentYear || (costYear === currentYear && costMonth < currentMonth)) {
                return res.status(400).json({
                    id: 'PAST_DATE',
                    message: 'Cannot add cost items with dates from past months'
                });
            }
        }

        // Create the new cost document and save it to MongoDB
        const newCost = new Cost({
            description,
            category,
            userid: parseInt(userid),
            sum: parseFloat(sum),
            date: costDate
        });
        await newCost.save();

        // Log the successful creation of the cost item
        logger.info({ costId: newCost._id }, 'New cost item added successfully');
        const accessLog = new Log({
            level: 'info',
            message: `POST /api/add cost endpoint accessed, created cost id: ${newCost._id}`,
            timestamp: new Date(),
            endpoint: '/api/add',
            method: 'POST'
        });
        await accessLog.save();

        // Return the newly created cost document as JSON
        res.json(newCost);
    } catch (err) {
        logger.error(err, 'Error adding cost item');
        res.status(500).json({ id: 'ADD_COST_ERROR', message: err.message });
    }
});

// GET /api/report — returns the monthly cost report for a specific user
app.get('/api/report', async (req, res) => {
    try {
        const { id, year, month } = req.query;

        // All three query parameters are required
        if (!id || !year || !month) {
            return res.status(400).json({
                id: 'MISSING_PARAMS',
                message: 'Query parameters id, year, and month are all required'
            });
        }

        const userid = parseInt(id);
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        // All three parameters must parse to valid numbers
        if (isNaN(userid) || isNaN(yearNum) || isNaN(monthNum)) {
            return res.status(400).json({
                id: 'INVALID_PARAMS',
                message: 'id, year, and month must all be valid numbers'
            });
        }

        // Month must be a calendar month between 1 and 12
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                id: 'INVALID_MONTH',
                message: 'month must be between 1 and 12'
            });
        }

        // Year must be a reasonable 4-digit year
        if (yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({
                id: 'INVALID_YEAR',
                message: 'year must be between 2000 and 2100'
            });
        }

        // The user must exist in the database
        const user = await User.findOne({ id: userid });
        if (!user) {
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: `No user found with id ${userid}` });
        }

        // Record that this specific endpoint was accessed
        logger.info({ userid, year: yearNum, month: monthNum }, '/api/report endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: `GET /api/report endpoint accessed for user ${userid}`,
            timestamp: new Date(),
            endpoint: '/api/report',
            method: 'GET'
        });
        await accessLog.save();

        // Check whether the requested month is entirely in the past
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const isPastMonth = yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth);

        /*
         * Computed Design Pattern Implementation:
         * When a report is requested for a month that has already ended, we first check
         * the "reports" collection for a pre-computed (cached) version of that report.
         * If a cached version exists, we return it immediately without touching the costs
         * collection at all — this is the "fast path" that saves database work.
         * If no cached version exists, we compute the report fresh from the costs collection,
         * then store the result in the reports collection before returning it, so that every
         * future request for the same month is served from the cache.
         * This caching strategy is safe because the server rejects any attempt to add a cost
         * item with a date from a past month, so a cached past-month report will never become
         * outdated or incorrect.
         */
        if (isPastMonth) {
            // Look for a pre-computed version of this report in the cache
            const cachedReport = await Report.findOne({ userid, year: yearNum, month: monthNum });
            if (cachedReport) {
                // Serve from cache — no need to re-query the costs collection
                return res.json(cachedReport.data);
            }
        }

        // Fetch all cost items for this user in the requested month and year
        const costs = await Cost.find({
            userid,
            $expr: {
                $and: [
                    { $eq: [{ $year: '$date' }, yearNum] },
                    { $eq: [{ $month: '$date' }, monthNum] }
                ]
            }
        });

        // Build an object with one empty array per category, then fill them in
        const grouped = {};
        VALID_CATEGORIES.forEach((cat) => { grouped[cat] = []; });

        costs.forEach((cost) => {
            grouped[cost.category].push({
                sum: cost.sum,
                description: cost.description,
                // Extract just the day number (1-31) from the full date
                day: new Date(cost.date).getDate()
            });
        });

        // Format costs as an array of single-key objects, one per category
        const formattedCosts = VALID_CATEGORIES.map((cat) => ({ [cat]: grouped[cat] }));

        const report = {
            userid,
            year: yearNum,
            month: monthNum,
            costs: formattedCosts
        };

        // Save the computed report to the cache if it covers a past month
        if (isPastMonth) {
            const computedReport = new Report({ userid, year: yearNum, month: monthNum, data: report });
            await computedReport.save();
        }

        res.json(report);
    } catch (err) {
        logger.error(err, 'Error generating monthly report');
        res.status(500).json({ id: 'REPORT_ERROR', message: err.message });
    }
});

// Only start listening for connections when this file is run directly, not during tests
if (require.main === module) {
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
        logger.info(`Costs service running on port ${PORT}`);
    });
}

module.exports = app;
