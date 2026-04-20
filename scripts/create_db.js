const { Client } = require('pg');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres', // Connect to default DB to create new one
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
};

async function createDatabase() {
    const client = new Client(config);
    try {
        await client.connect();
        const dbName = process.env.DB_NAME || 'osep_db';

        // Check if exists
        const check = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        if (check.rowCount === 0) {
            console.log(`Creating database ${dbName}...`);
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log('Base de données créée avec succès.');
        } else {
            console.log(`La base de données ${dbName} existe déjà.`);
        }
    } catch (err) {
        console.error('Erreur lors de la création de la base de données:', err);
    } finally {
        await client.end();
    }
}

createDatabase();
