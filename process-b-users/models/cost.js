'use strict';

const mongoose = require('mongoose');

/*
 * we need the cost schema here in the users process too.
 * we use it only to calculate the total amount a user spent
 * when someone calls GET /api/users/:id.
 * the actual cost management happens in the costs process.
 */
const costSchema = new mongoose.Schema({
    description: { type: String, required: true },
    // only these five categories are allowed, mongodb rejects anything else
    category: {
        type: String,
        required: true,
        enum: ['food', 'health', 'housing', 'sports', 'education']
    },
    userid: { type: Number, required: true },
    // the amount of money, stored as a decimal number
    sum: { type: Number, required: true },
    // if no date is given, we use the time the request arrived
    date: { type: Date, default: Date.now }
});

// this makes sure we dont create the Cost model twice when tests run
module.exports = mongoose.models.Cost || mongoose.model('Cost', costSchema);
