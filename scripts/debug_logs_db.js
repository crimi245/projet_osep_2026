const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    await client.connect();

    console.log('--- Checking for WARN logs on 2026-02-11 ---');

    const query = `
        SELECT created_at, level, action 
        FROM system_logs 
        WHERE level = 'WARN' 
        AND created_at >= '2026-02-11 00:00:00' 
        AND created_at <= '2026-02-11 23:59:59'
    `;

    try {
        const res = await client.query(query);
        console.log(`Found ${res.rowCount} logs.`);
        res.rows.forEach(r => console.log(`${r.created_at} - ${r.level} - ${r.action}`));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
