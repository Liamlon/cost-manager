'use strict';

const mongoose = require('mongoose');

/* Schema for user documents stored in the "users" collection.
 * Note: "id" and "_id" are two different fields.
 * "_id" is MongoDB's internal identifier (auto-generated ObjectId).
 * "id" is the custom numeric identifier we assign to each user.
 */
const userSchema = new mongoose.Schema({
    // Custom numeric id — different from MongoDB's auto-generated _id
    id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    birthday: { type: Date, required: true }
});

// Guard against "model already compiled" errors that appear during testing
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
