const db = require('./db.js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log(' Starting database migration...\n');

        // Read the migration script
        const sqlScript = fs.readFileSync(path.join(__dirname, 'fix_meetings_schema.sql'), 'utf8');

        // Execute the migration
        const result = await db.query(sqlScript);

        console.log(' Migration terminée avec succès !\n');

        // Verify the changes
        const verify = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'meetings' AND column_name IN ('id', 'uuid')
            ORDER BY column_name
        `);

        console.log('Updated schema:');
        console.table(verify.rows);

        // Show sample data
        const meetings = await db.query('SELECT id, uuid, title FROM meetings LIMIT 3');
        console.log('\nSample meetings:');
        console.table(meetings.rows);

        process.exit(0);
    } catch (err) {
        console.error(' Échec de la migration:', err.message);
        console.error(err);
        process.exit(1);
    }
}

runMigration();
