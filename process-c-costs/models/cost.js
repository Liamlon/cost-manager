'use strict';

const mongoose = require('mongoose');

// this describes what a cost item looks like when we save it to the database
const costSchema = new mongoose.Schema({
    description: { type: String, required: true },
    // only these 5 categories are allowed, mongodb will reject anything else automatically
    category: {
        type: String,
        required: true,
        enum: ['food', 'health', 'housing', 'sports', 'education']
    },
    userid: { type: Number, required: true },
    // the amount of money, stored as a decimal number
    sum: { type: Number, required: true },
    // if no date is given, we use the exact time the request arrived at the server
    date: { type: Date, default: Date.now }
});

// this stops the model from being created twice if the file gets loaded more than once
module.exports = mongoose.models.Cost || mongoose.model('Cost', costSchema);
