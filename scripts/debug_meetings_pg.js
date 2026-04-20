const db = require('../config/db');

async function checkMeetings() {
    try {
        console.log('Connecting to database...');
        const res = await db.query('SELECT * FROM meetings ORDER BY created_at DESC LIMIT 5');
        console.log(`Found ${res.rows.length} meetings.`);
        res.rows.forEach(m => {
            console.log(`- [${m.id}] ${m.title} | Start: ${m.start_time} | End: ${m.end_time}`);
        });

        // Check user count just in case
        const userRes = await db.query('SELECT COUNT(*) FROM users');
        console.log(`Total users: ${userRes.rows[0].count}`);

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        // Pool is global in db.js so we might need to manually exit
        process.exit();
    }
}

checkMeetings();
