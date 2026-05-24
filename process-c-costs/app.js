'use strict';

// load settings from .env before anything else
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const Cost = require('./models/cost');
const User = require('./models/user');
const Log = require('./models/log');
const Report = require('./models/report');

const app = express();

// tell express how to read json from request bodies
app.use(express.json());

// these are the only 5 categories we allow for costs
const validCategories = ['food', 'health', 'housing', 'sports', 'education'];

// pino prints log messages to the console
const logger = pino({ level: 'info' });

// connect to mongodb using the url from .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error(err, 'MongoDB connection error'));

/*
 * this runs before every request that comes in.
 * it saves a record to the database every single time.
 * its like the server writing in its diary for every visitor.
 */
app.use(async (req, res, next) => {
    try {
        // print the request to the console
        logger.info({ method: req.method, url: req.url }, 'Request received');

        // save the request to mongodb too
        const requestLog = new Log({
            level: 'info',
            message: `${req.method} ${req.url}`,
            timestamp: new Date(),
            endpoint: req.url,
            method: req.method
        });
        await requestLog.save();
    } catch (err) {
        // if logging failed, thats ok, we still let the request through
        logger.error(err, 'Failed to save request log');
    }
    next();
});

// POST /api/add - add a new cost item for a user
app.post('/api/add', async (req, res) => {
    try {
        const { description, category, userid, sum, date } = req.body;

        // all four main fields must be there, reject if something is missing
        if (!description || !category || userid === undefined || sum === undefined) {
            return res.status(400).json({
                id: 'MISSING_FIELDS',
                message: 'description, category, userid, and sum are all required'
            });
        }

        // check that the category is one of the five allowed ones
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                id: 'INVALID_CATEGORY',
                message: `category must be one of: ${validCategories.join(', ')}`
            });
        }

        // userid needs to be a real number
        if (isNaN(parseInt(userid))) {
            return res.status(400).json({ id: 'INVALID_USERID', message: 'userid must be a valid number' });
        }

        // make sure the user actually exists before we add a cost for them
        const user = await User.findOne({ id: parseInt(userid) });
        if (!user) {
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: `No user found with id ${userid}` });
        }

        // figure out the date for this cost - defaults to right now if not given
        let costDate = new Date();
        if (date) {
            costDate = new Date(date);

            // if the date string they gave us is not a real date, tell them
            if (isNaN(costDate.getTime())) {
                return res.status(400).json({ id: 'INVALID_DATE', message: 'The date value provided is not valid' });
            }

            // we dont allow costs from past months because it would mess up the cached reports
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

        // create the cost and save it to the database
        const newCost = new Cost({
            description,
            category,
            userid: parseInt(userid),
            sum: parseFloat(sum),
            date: costDate
        });
        await newCost.save();

        // write a log that a cost was added successfully
        logger.info({ costId: newCost._id }, 'New cost item added successfully');
        const accessLog = new Log({
            level: 'info',
            message: `POST /api/add cost endpoint accessed, created cost id: ${newCost._id}`,
            timestamp: new Date(),
            endpoint: '/api/add',
            method: 'POST'
        });
        await accessLog.save();

        // send back the cost we just saved
        res.json(newCost);
    } catch (err) {
        logger.error(err, 'Error adding cost item');
        res.status(500).json({ id: 'ADD_COST_ERROR', message: err.message });
    }
});

// GET /api/report - get a monthly spending report for a specific user
app.get('/api/report', async (req, res) => {
    try {
        const { id, year, month } = req.query;

        // we need all three to make the report
        if (!id || !year || !month) {
            return res.status(400).json({
                id: 'MISSING_PARAMS',
                message: 'Query parameters id, year, and month are all required'
            });
        }

        const userid = parseInt(id);
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        // all three must be real numbers
        if (isNaN(userid) || isNaN(yearNum) || isNaN(monthNum)) {
            return res.status(400).json({
                id: 'INVALID_PARAMS',
                message: 'id, year, and month must all be valid numbers'
            });
        }

        // month has to be between 1 and 12 obviously
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({
                id: 'INVALID_MONTH',
                message: 'month must be between 1 and 12'
            });
        }

        // year needs to look like a real year
        if (yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({
                id: 'INVALID_YEAR',
                message: 'year must be between 2000 and 2100'
            });
        }

        // the user has to exist before we can make a report for them
        const user = await User.findOne({ id: userid });
        if (!user) {
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: `No user found with id ${userid}` });
        }

        // save a log that someone asked for a report
        logger.info({ userid, year: yearNum, month: monthNum }, '/api/report endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: `GET /api/report endpoint accessed for user ${userid}`,
            timestamp: new Date(),
            endpoint: '/api/report',
            method: 'GET'
        });
        await accessLog.save();

        // check if the month they asked about is already in the past
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const isPastMonth = yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth);

        /*
         * Computed Design Pattern:
         * when someone asks for a report from a month that already ended, we first check
         * if we already calculated and saved this report before. if yes, we just send back
         * the saved one - no need to go through the whole database again.
         * if we dont have it saved yet, we calculate it fresh, save it, then send it back.
         * this works because we never allow adding costs from past months - so a saved
         * past-month report will never become wrong or out of date.
         */
        if (isPastMonth) {
            // check the cache first - maybe we already have this one saved
            const cachedReport = await Report.findOne({ userid, year: yearNum, month: monthNum });
            if (cachedReport) {
                // we have it, just send it straight back without touching the costs collection
                return res.json(cachedReport.data);
            }
        }

        // fetch all the cost items for this user in the requested month and year
        const costs = await Cost.find({
            userid,
            $expr: {
                $and: [
                    { $eq: [{ $year: '$date' }, yearNum] },
                    { $eq: [{ $month: '$date' }, monthNum] }
                ]
            }
        });

        // start with all 5 categories as empty arrays, then fill in the ones that have costs
        const grouped = {};
        validCategories.forEach((cat) => { grouped[cat] = []; });

        costs.forEach((cost) => {
            grouped[cost.category].push({
                sum: cost.sum,
                description: cost.description,
                // just the day number like 17, not the full date
                day: new Date(cost.date).getDate()
            });
        });

        // format it as an array where each item is one category with its costs
        const formattedCosts = validCategories.map((cat) => ({ [cat]: grouped[cat] }));

        const report = {
            userid,
            year: yearNum,
            month: monthNum,
            costs: formattedCosts
        };

        // if this is a past month, save the report to the cache so next time is faster
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

// only start listening if we ran this file directly, not from tests
if (require.main === module) {
    const port = process.env.PORT || 3003;
    app.listen(port, () => {
        logger.info(`Costs service running on port ${port}`);
    });
}

module.exports = app;
