'use strict';

const mongoose = require('mongoose');

// this is the shape of what a log looks like when we save it to the database
const logSchema = new mongoose.Schema({
    // was it a normal message (info) or did something go wrong (error)
    level: { type: String, required: true },
    // what actually happened, like "GET /api/logs"
    message: { type: String, required: true },
    // if we dont give a time, it just uses right now
    timestamp: { type: Date, default: Date.now },
    // which url path was visited, like /api/logs
    endpoint: { type: String, default: '' },
    // was it a GET or a POST request
    method: { type: String, default: '' }
});

// this makes sure we dont accidentally create the Log model twice
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
