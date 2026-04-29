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

// Helper: insert a test user directly into MongoDB (bypasses the users API)
async function createTestUser(id) {
    const User = require('../models/user');
    return User.create({ id, first_name: 'Test', last_name: 'User', birthday: new Date('1990-01-01') });
}

// ----------------------------------------------------------------
// POST /api/add — Adding cost items
// ----------------------------------------------------------------
describe('POST /api/add (add cost)', () => {
    test('should add a cost item and return it as JSON', async () => {
        await createTestUser(5001);

        const res = await request(app).post('/api/add').send({
            userid: 5001,
            description: 'milk 9',
            category: 'food',
            sum: 8
        });
        expect(res.status).toBe(200);
        expect(res.body.userid).toBe(5001);
        expect(res.body.description).toBe('milk 9');
        expect(res.body.category).toBe('food');
        expect(res.body.sum).toBe(8);
    });

    test('should return 400 when required fields are missing', async () => {
        // Only userid and description are provided — category and sum are missing
        const res = await request(app).post('/api/add').send({ userid: 5001, description: 'coffee' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 for a category that is not in the allowed list', async () => {
        await createTestUser(5002);

        const res = await request(app).post('/api/add').send({
            userid: 5002,
            description: 'something',
            category: 'entertainment',
            sum: 10
        });
        expect(res.status).toBe(400);
    });

    test('should return 404 when the userid does not match any user', async () => {
        // No user with id 99999 exists in the database
        const res = await request(app).post('/api/add').send({
            userid: 99999,
            description: 'coffee',
            category: 'food',
            sum: 5
        });
        expect(res.status).toBe(404);
    });

    test('should return 400 when userid is not a number', async () => {
        const res = await request(app).post('/api/add').send({
            userid: 'not-a-number',
            description: 'coffee',
            category: 'food',
            sum: 5
        });
        expect(res.status).toBe(400);
    });
});

// ----------------------------------------------------------------
// GET /api/report — Monthly cost reports
// ----------------------------------------------------------------
describe('GET /api/report', () => {
    test('should return a report that includes all five categories', async () => {
        await createTestUser(6001);

        const now = new Date();
        const res = await request(app).get(
            `/api/report?id=6001&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
        );
        expect(res.status).toBe(200);
        expect(res.body.userid).toBe(6001);
        expect(res.body.year).toBe(now.getFullYear());
        expect(Array.isArray(res.body.costs)).toBe(true);

        // All five categories must be present even if their arrays are empty
        const categoryNames = res.body.costs.map((entry) => Object.keys(entry)[0]);
        expect(categoryNames).toContain('food');
        expect(categoryNames).toContain('health');
        expect(categoryNames).toContain('housing');
        expect(categoryNames).toContain('sports');
        expect(categoryNames).toContain('education');
    });

    test('should include a cost item that was added for the current month', async () => {
        await createTestUser(6002);

        // Add a cost item (it will be dated to right now by default)
        await request(app).post('/api/add').send({
            userid: 6002,
            description: 'milk 9',
            category: 'food',
            sum: 8
        });

        const now = new Date();
        const res = await request(app).get(
            `/api/report?id=6002&year=${now.getFullYear()}&month=${now.getMonth() + 1}`
        );
        expect(res.status).toBe(200);

        // The food category should contain exactly the item we just added
        const foodEntry = res.body.costs.find((entry) => entry.food !== undefined);
        expect(foodEntry.food).toHaveLength(1);
        expect(foodEntry.food[0].description).toBe('milk 9');
        expect(foodEntry.food[0].sum).toBe(8);
        expect(foodEntry.food[0]).toHaveProperty('day');
    });

    test('should return 400 when query parameters are missing', async () => {
        // Only "id" is provided — "year" and "month" are missing
        const res = await request(app).get('/api/report?id=6001');
        expect(res.status).toBe(400);
    });

    test('should return 404 when the user does not exist', async () => {
        const res = await request(app).get('/api/report?id=99999&year=2026&month=4');
        expect(res.status).toBe(404);
    });

    test('should return 400 when query parameters are not valid numbers', async () => {
        const res = await request(app).get('/api/report?id=abc&year=2026&month=4');
        expect(res.status).toBe(400);
    });
});
