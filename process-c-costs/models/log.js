'use strict';

const mongoose = require('mongoose');

// this is the shape of a log entry saved every time someone makes a request
const logSchema = new mongoose.Schema({
    // info or error
    level: { type: String, required: true },
    // what happened, like "GET /api/add"
    message: { type: String, required: true },
    // defaults to right now if not given
    timestamp: { type: Date, default: Date.now },
    // the url that was visited, like /api/add or /api/report
    endpoint: { type: String, default: '' },
    // GET or POST
    method: { type: String, default: '' }
});

// stop it from being created twice when tests run
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
