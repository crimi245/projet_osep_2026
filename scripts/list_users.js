const db = require('./db.js');

async function listUsers() {
    try {
        const res = await db.query('SELECT id, username, role, full_name, coordination_id FROM users ORDER BY username');
        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        // process.exit(0);
        setTimeout(() => process.exit(0), 500);
    }
}

listUsers();
