'use strict';

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://admin:liam1203@ac-pt0mbmj-shard-00-00.sg6lqke.mongodb.net:27017,ac-pt0mbmj-shard-00-01.sg6lqke.mongodb.net:27017,ac-pt0mbmj-shard-00-02.sg6lqke.mongodb.net:27017/costmanager?ssl=true&replicaSet=atlas-oqjnw6-shard-0&authSource=admin&appName=Cluster0';

async function cleanup() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected');

    // Delete all costs (test data)
    const costs = await mongoose.connection.collection('costs').deleteMany({});
    console.log('Costs deleted:', costs.deletedCount);

    // Delete test user 999999, keep mosh israeli (123123)
    const users = await mongoose.connection.collection('users').deleteMany({ id: { $ne: 123123 } });
    console.log('Test users deleted:', users.deletedCount);

    // Delete cached reports
    const reports = await mongoose.connection.collection('reports').deleteMany({});
    console.log('Reports deleted:', reports.deletedCount);

    await mongoose.disconnect();
    console.log('Done — database now has only mosh israeli');
}

cleanup().catch(console.error);
