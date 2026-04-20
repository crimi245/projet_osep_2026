const db = require('./db');

async function inspect() {
    try {
        console.log("--- MEETINGS COLUMNS ---");
        const meetings = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'meetings';
        `);
        console.table(meetings.rows);

        console.log("\n--- SYSTEM_LOGS COLUMNS ---");
        const logs = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_logs';
        `);
        console.table(logs.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
