'use strict';

const mongoose = require('mongoose');

// this describes what a log entry looks like in the database
const logSchema = new mongoose.Schema({
    // info or error
    level: { type: String, required: true },
    // what happened
    message: { type: String, required: true },
    // defaults to right now if not given
    timestamp: { type: Date, default: Date.now },
    // the url that was accessed, like /api/about
    endpoint: { type: String, default: '' },
    // GET or POST
    method: { type: String, default: '' }
});

// stop the model from being created twice
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
