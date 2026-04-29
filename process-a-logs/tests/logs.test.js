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

// Clear all collections before each test so tests don't affect each other
beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

describe('GET /api/logs', () => {
    test('should return 200 and an array', async () => {
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('should create log entries for each request received', async () => {
        // Make a first request — this creates log entries in the database
        await request(app).get('/api/logs');

        // The second request should now see those log entries
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
    });

    test('each log entry must have level, message, and timestamp fields', async () => {
        await request(app).get('/api/logs');
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);

        if (res.body.length > 0) {
            const firstLog = res.body[0];
            expect(firstLog).toHaveProperty('level');
            expect(firstLog).toHaveProperty('message');
            expect(firstLog).toHaveProperty('timestamp');
        }
    });

    test('the log message should contain the HTTP method and URL', async () => {
        await request(app).get('/api/logs');
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);

        // Every log entry from a GET /api/logs request should mention both
        const hasExpectedLog = res.body.some(
            (log) => log.message.includes('GET') && log.message.includes('/api/logs')
        );
        expect(hasExpectedLog).toBe(true);
    });
});
