'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pino = require('pino');
const User = require('./models/user');
const Cost = require('./models/cost');
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

// GET /api/users — returns a list of all users in the database
app.get('/api/users', async (req, res) => {
    try {
        // Record that this specific endpoint was accessed
        logger.info('/api/users endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: 'GET /api/users endpoint accessed',
            timestamp: new Date(),
            endpoint: '/api/users',
            method: 'GET'
        });
        await accessLog.save();

        // Retrieve all user documents from the database
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        logger.error(err, 'Error fetching users');
        res.status(500).json({ id: 'GET_USERS_ERROR', message: err.message });
    }
});

// GET /api/users/:id — returns one user's details plus their total costs
app.get('/api/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // The id in the URL must be a valid number
        if (isNaN(userId)) {
            return res.status(400).json({ id: 'INVALID_ID', message: 'User id must be a valid number' });
        }

        // Record that this specific endpoint was accessed
        logger.info({ userId }, '/api/users/:id endpoint accessed');
        const accessLog = new Log({
            level: 'info',
            message: `GET /api/users/${userId} endpoint accessed`,
            timestamp: new Date(),
            endpoint: `/api/users/${userId}`,
            method: 'GET'
        });
        await accessLog.save();

        // Find the user by their custom "id" field (not MongoDB's _id)
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ id: 'USER_NOT_FOUND', message: `No user found with id ${userId}` });
        }

        // Add up the "sum" field of every cost document that belongs to this user
        const costs = await Cost.find({ userid: userId });
        const total = costs.reduce((runningTotal, cost) => runningTotal + cost.sum, 0);

        // Return only the required four fields: id, first_name, last_name, total
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

// POST /api/add — adds a new user to the database
app.post('/api/add', async (req, res) => {
    try {
        const { id, first_name, last_name, birthday } = req.body;

        // All four fields are required — reject the request if any are missing
        if (id === undefined || !first_name || !last_name || !birthday) {
            return res.status(400).json({
                id: 'MISSING_FIELDS',
                message: 'id, first_name, last_name, and birthday are all required'
            });
        }

        // The id field must be a valid number
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ id: 'INVALID_ID', message: 'id must be a valid number' });
        }

        // Prevent creating two users with the same id
        const existingUser = await User.findOne({ id: parseInt(id) });
        if (existingUser) {
            return res.status(409).json({ id: 'USER_EXISTS', message: `A user with id ${id} already exists` });
        }

        // Create the new user document and save it to MongoDB
        const newUser = new User({
            id: parseInt(id),
            first_name,
            last_name,
            birthday: new Date(birthday)
        });
        await newUser.save();

        // Log the successful creation of the user
        logger.info({ userId: newUser.id }, 'New user added successfully');
        const accessLog = new Log({
            level: 'info',
            message: `POST /api/add user endpoint accessed, created user id: ${newUser.id}`,
            timestamp: new Date(),
            endpoint: '/api/add',
            method: 'POST'
        });
        await accessLog.save();

        // Return the newly created user document as JSON
        res.json(newUser);
    } catch (err) {
        logger.error(err, 'Error adding user');
        res.status(500).json({ id: 'ADD_USER_ERROR', message: err.message });
    }
});

// Only start listening for connections when this file is run directly, not during tests
if (require.main === module) {
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
        logger.info(`Users service running on port ${PORT}`);
    });
}

module.exports = app;
