'use strict';

const mongoose = require('mongoose');

// Schema for log entries - every HTTP request and endpoint access is recorded here
const logSchema = new mongoose.Schema({
    level: { type: String, required: true },
    message: { type: String, required: true },
    // Defaults to the exact time the log was created
    timestamp: { type: Date, default: Date.now },
    // The URL path that was accessed (e.g. /api/users)
    endpoint: { type: String, default: '' },
    method: { type: String, default: '' }
});

// Guard against "model already compiled" errors that appear during testing
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
