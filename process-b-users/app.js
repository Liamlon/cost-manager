'use strict';

// load settings from the .env file before anything else
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const User = require('./models/user');
const Cost = require('./models/cost');
const Log = require('./models/log');

const app = express();

// tell express to understand json that people send in requests
app.use(express.json());

// pino is the thing that prints log messages
const logger = pino({ level: 'info' });

// connect to the cloud database using the link in .env
mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error(err, 'MongoDB connection error'));

/*
 * this runs before every request that comes in.
 * it saves a record of every request to the database so we have a full history.
 * its like a security camera that never turns off.
 */
app.use(async (req, res, next) => {
    try {
        // print what request came in so we can see it
        logger.info({ method: req.method, url: req.url }, 'Request received');

        // also save it to mongodb so we have a permanent copy
        const requestLog = new Log({
            level: 'info',
            message: `${req.method} ${req.url}`,
            timestamp: new Date(),
            endpoint: req.url,
            method: req.method
        });
        await requestLog.save();
    } catch (err) {
        // if logging broke thats fine, dont stop the request from going through
        logger.error(err, 'Failed to save request log');
    }
    next();
});

// GET /api/users - give back a list of all users in the database
app.get('/api/users', async (req, res) => {
    try {
        // write a log that says someone visited this page
        logger.info('/api/users endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: 'GET /api/users endpoint accessed',
            timestamp: new Date(),
            endpoint: '/api/users',
            method: 'GET'
        });
        await accessLog.save();

        // get every user from the database and send them all back
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        logger.error(err, 'Error fetching users');
        res.status(500).json({ id: 'GET_USERS_ERROR', message: err.message });
    }
});

// GET /api/users/:id - get one specific user plus how much they spent in total
app.get('/api/users/:id', async (req, res) => {
    try {
        // turn the id from text into a real number
        const userId = parseInt(req.params.id);

        // if the id they gave us isnt a real number, tell them
        if (isNaN(userId)) {
            return res.status(400).json({ id: 'INVALID_ID', message: 'User id must be a valid number' });
        }

        // write a log saying someone visited this page
        logger.info({ userId }, '/api/users/:id endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: `GET /api/users/${userId} endpoint accessed`,
            timestamp: new Date(),
            endpoint: `/api/users/${userId}`,
            method: 'GET'
        });
        await accessLog.save();

        // look up the user by their custom id field (not the mongodb _id)
        const user = await User.findOne({ id: userId });

        // if nobody has that id, say so
        if (!user) {
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: `No user found with id ${userId}` });
        }

        // find all the cost items that belong to this user
        const costs = await Cost.find({ userid: userId });

        // add up all the amounts to get the grand total
        const total = costs.reduce((runningTotal, cost) => runningTotal + cost.sum, 0);

        // send back only the four fields that the project requires
        res.json({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            total
        });
    } catch (err) {
        logger.error(err, 'Error fetching user details');
        res.status(500).json({ id: 'GET_USER_ERROR', message: err.message });
    }
});

// POST /api/add - add a brand new user to the database
app.post('/api/add', async (req, res) => {
    try {
        const { id, first_name, last_name, birthday } = req.body;

        // check that they sent all four required fields, reject if anything is missing
        if (id === undefined || !first_name || !last_name || !birthday) {
            return res.status(400).json({
                id: 'MISSING_FIELDS',
                message: 'id, first_name, last_name, and birthday are all required'
            });
        }

        // make sure the id they gave us is actually a number
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ id: 'INVALID_ID', message: 'id must be a valid number' });
        }

        // check if a user with this id already exists - we cant have two of the same
        const existingUser = await User.findOne({ id: parseInt(id) });
        if (existingUser) {
            return res.status(409).json({ id: 'USER_EXISTS', message: `A user with id ${id} already exists` });
        }

        // create the new user and save them to the database
        const newUser = new User({
            id: parseInt(id),
            first_name,
            last_name,
            birthday: new Date(birthday)
        });
        await newUser.save();

        // write a log that the user was added successfully
        logger.info({ userId: newUser.id }, 'New user added successfully');
        const accessLog = new Log({
            level: 'info',
            message: `POST /api/add user endpoint accessed, created user id: ${newUser.id}`,
            timestamp: new Date(),
            endpoint: '/api/add',
            method: 'POST'
        });
        await accessLog.save();

        // send back the user we just created
        res.json(newUser);
    } catch (err) {
        logger.error(err, 'Error adding user');
        res.status(500).json({ id: 'ADD_USER_ERROR', message: err.message });
    }
});

// only start the server if this file was run directly, not from a test
if (require.main === module) {
    const port = process.env.PORT || 3002;
    app.listen(port, () => {
        logger.info(`Users service running on port ${port}`);
    });
}

module.exports = app;
