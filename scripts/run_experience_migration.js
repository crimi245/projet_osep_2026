const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'add_experience_fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration: add_experience_fields.sql');
        await db.exec(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        // We need to close the pool to exit the script if db.js doesn't handle it.
        // db.js exports pool, so we can end it.
        if (db.pool) await db.pool.end();
    }
}

runMigration();
