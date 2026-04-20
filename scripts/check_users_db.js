const db = require('../config/db');

async function checkUsers() {
    try {
        console.log("--- Checking Users in DB ---");
        const res = await db.query('SELECT id, username, deleted_at FROM users');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkUsers();
