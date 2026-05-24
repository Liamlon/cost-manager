'use strict';

const mongoose = require('mongoose');

/*
 * this is where we save reports that we already calculated before.
 * when someone asks for a report from a past month, we calculate it once
 * and save the result here so next time we dont have to calculate it again.
 * this is the Computed Design Pattern - calculate once, reuse forever.
 * it works because we never allow adding costs from past months,
 * so a saved old report will never become wrong or out of date.
 */
const reportSchema = new mongoose.Schema({
    userid: { type: Number, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    // we store the whole report object here so we can just send it straight back
    data: { type: mongoose.Schema.Types.Mixed, required: true }
});

// stop it from being created twice when tests run
module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
