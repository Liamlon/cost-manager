'use strict';

const mongoose = require('mongoose');

// this is the shape of what we save every time a request comes in
const logSchema = new mongoose.Schema({
    // was it normal info or an error
    level: { type: String, required: true },
    // describes what happened
    message: { type: String, required: true },
    // defaults to right now if nothing is given
    timestamp: { type: Date, default: Date.now },
    // which url was hit, like /api/users
    endpoint: { type: String, default: '' },
    // GET or POST
    method: { type: String, default: '' }
});

// this makes sure we dont create the Log model twice when tests run
module.exports = mongoose.models.Log || mongoose.model('Log', logSchema);
