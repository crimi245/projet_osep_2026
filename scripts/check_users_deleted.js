const db = require('../config/db');

async function check() {
    try {
        console.log("--- Users in DB ---");
        const res = await db.query("SELECT id, username, role, deleted_at FROM users ORDER BY id DESC");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

check();
