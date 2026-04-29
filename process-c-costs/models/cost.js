'use strict';

const mongoose = require('mongoose');

// Schema for cost documents stored in the "costs" collection
const costSchema = new mongoose.Schema({
    description: { type: String, required: true },
    // Category must be one of the five supported values
    category: {
        type: String,
        required: true,
        enum: ['food', 'health', 'housing', 'sports', 'education']
    },
    userid: { type: Number, required: true },
    // Sum is a floating-point number (Double in MongoDB)
    sum: { type: Number, required: true },
    // Defaults to the time the cost item was received by the server
    date: { type: Date, default: Date.now }
});

// Guard against "model already compiled" errors that appear during testing
module.exports = mongoose.models.Cost || mongoose.model('Cost', costSchema);
