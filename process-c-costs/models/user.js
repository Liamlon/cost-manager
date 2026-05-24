'use strict';

const mongoose = require('mongoose');

/*
 * we need the user schema here in the costs process too,
 * so we can check if a user actually exists before we let someone
 * add a cost for them. both processes share the same mongodb database,
 * so we read from the same users collection.
 */
const userSchema = new mongoose.Schema({
    // our own custom number id, different from mongodb's automatic _id
    id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    birthday: { type: Date, required: true }
});

// stop it from being created twice when tests run
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
