const db = require('../config/db');

async function migrate() {
    try {
        console.log("Adding waiting_room_opens_at column...");
        await db.query(`
            ALTER TABLE meetings 
            ADD COLUMN IF NOT EXISTS waiting_room_opens_at INTEGER DEFAULT 15;
        `);
        console.log("Migration successful!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
