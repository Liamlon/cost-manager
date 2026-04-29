'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongod;
let app;

// Start an in-memory MongoDB server before any tests run
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    // Set the URI before requiring app.js so it connects to the test database
    process.env.MONGO_URI = mongod.getUri();

    // Set team member names in the environment so the endpoint has something to return
    process.env.TEAM_MEMBER_1_FIRST_NAME = 'John';
    process.env.TEAM_MEMBER_1_LAST_NAME = 'Doe';
    process.env.TEAM_MEMBER_2_FIRST_NAME = 'Jane';
    process.env.TEAM_MEMBER_2_LAST_NAME = 'Smith';

    app = require('../app');

    // Wait until the mongoose connection is fully open
    await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) {
            resolve();
        } else {
            mongoose.connection.once('connected', resolve);
        }
    });
}, 30000);

// Shut down the test database after all tests are done
afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

// ----------------------------------------------------------------
// GET /api/about — Developer team info
// ----------------------------------------------------------------
describe('GET /api/about', () => {
    test('should return 200 and an array', async () => {
        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('should return one entry per team member', async () => {
        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
        // We set two team members in beforeAll, so we expect two entries
        expect(res.body.length).toBe(2);
    });

    test('each member must have first_name and last_name and nothing else', async () => {
        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);

        res.body.forEach((member) => {
            expect(member).toHaveProperty('first_name');
            expect(member).toHaveProperty('last_name');
            // The response must not include any extra fields like id or birthday
            expect(Object.keys(member)).toEqual(['first_name', 'last_name']);
        });
    });

    test('names should match the values set in environment variables', async () => {
        const res = await request(app).get('/api/about');
        expect(res.status).toBe(200);
        expect(res.body[0].first_name).toBe('John');
        expect(res.body[0].last_name).toBe('Doe');
        expect(res.body[1].first_name).toBe('Jane');
        expect(res.body[1].last_name).toBe('Smith');
    });
});
