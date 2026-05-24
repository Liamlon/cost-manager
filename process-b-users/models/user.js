'use strict';

const mongoose = require('mongoose');

/*
 * this is what a user looks like when we save them to the database.
 * important thing - id and _id are two totally different things.
 * _id is the one mongodb creates automatically when you save something.
 * id is the custom number we give each user ourselves, like 123123.
 */
const userSchema = new mongoose.Schema({
    // our own custom number id, like 123123 - not the mongodb one
    id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    birthday: { type: Date, required: true }
});

// this makes sure we dont create the User model twice when tests run
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
