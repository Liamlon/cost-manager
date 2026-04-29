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

// ----------------------------------------------------------------
// POST /api/add — Adding users
// ----------------------------------------------------------------
describe('POST /api/add (add user)', () => {
    test('should add a new user and return it as JSON', async () => {
        const res = await request(app).post('/api/add').send({
            id: 1001,
            first_name: 'Alice',
            last_name: 'Smith',
            birthday: '1995-06-15'
        });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(1001);
        expect(res.body.first_name).toBe('Alice');
        expect(res.body.last_name).toBe('Smith');
    });

    test('should return 400 when required fields are missing', async () => {
        // Only id is sent — the other three required fields are missing
        const res = await request(app).post('/api/add').send({ id: 1002 });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 when id is not a number', async () => {
        const res = await request(app).post('/api/add').send({
            id: 'not-a-number',
            first_name: 'Bob',
            last_name: 'Jones',
            birthday: '1990-01-01'
        });
        expect(res.status).toBe(400);
    });

    test('should return 409 when a user with the same id already exists', async () => {
        // Add the user the first time — this should succeed
        await request(app).post('/api/add').send({
            id: 1003,
            first_name: 'Carol',
            last_name: 'White',
            birthday: '1988-03-20'
        });

        // Trying to add the same id again should fail with 409 Conflict
        const res = await request(app).post('/api/add').send({
            id: 1003,
            first_name: 'Carol2',
            last_name: 'White2',
            birthday: '1988-03-20'
        });
        expect(res.status).toBe(409);
    });
});

// ----------------------------------------------------------------
// GET /api/users — Listing all users
// ----------------------------------------------------------------
describe('GET /api/users', () => {
    test('should return 200 and an array', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('should include a user that was previously added', async () => {
        await request(app).post('/api/add').send({
            id: 2001,
            first_name: 'Dave',
            last_name: 'Black',
            birthday: '1985-07-10'
        });

        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);

        // The user we just added should appear in the list
        const found = res.body.find((u) => u.id === 2001);
        expect(found).toBeDefined();
        expect(found.first_name).toBe('Dave');
    });
});

// ----------------------------------------------------------------
// GET /api/users/:id — Getting one user's details
// ----------------------------------------------------------------
describe('GET /api/users/:id', () => {
    test('should return the user with id, first_name, last_name, and total', async () => {
        await request(app).post('/api/add').send({
            id: 3001,
            first_name: 'Eve',
            last_name: 'Green',
            birthday: '1992-11-05'
        });

        const res = await request(app).get('/api/users/3001');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(3001);
        expect(res.body.first_name).toBe('Eve');
        expect(res.body.last_name).toBe('Green');
        // Total costs should be 0 because no costs have been added
        expect(res.body.total).toBe(0);
    });

    test('should return 404 when the user does not exist', async () => {
        const res = await request(app).get('/api/users/99999');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 when the id in the URL is not a number', async () => {
        const res = await request(app).get('/api/users/not-a-number');
        expect(res.status).toBe(400);
    });
});
