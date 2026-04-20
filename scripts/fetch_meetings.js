const db = require('./db.js');

async function listMeetings() {
    try {
        const res = await db.query('SELECT * FROM meetings ORDER BY start_time DESC LIMIT 5');
        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        setTimeout(() => process.exit(0), 500);
    }
}

listMeetings();
