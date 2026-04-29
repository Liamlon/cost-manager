'use strict';

const mongoose = require('mongoose');

/*
 * Schema for pre-computed (cached) monthly reports stored in the "reports" collection.
 * This collection is the heart of the Computed Design Pattern:
 * when a report for a past month is computed for the first time, the full result
 * is stored here so that future requests can be answered instantly from this cache
 * rather than by re-querying the entire costs collection.
 */
const reportSchema = new mongoose.Schema({
    userid: { type: Number, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    // The complete report JSON object is stored in the "data" field
    data: { type: mongoose.Schema.Types.Mixed, required: true }
});

// Guard against "model already compiled" errors that appear during testing
module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
