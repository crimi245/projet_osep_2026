const db = require('./db');

async function inspectUsers() {
    try {
        console.log('--- TOUS LES UTILISATEURS (y compris supprimés) ---');
        const res = await db.query('SELECT id, username, role, full_name, deleted_at FROM users ORDER BY id');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectUsers();
