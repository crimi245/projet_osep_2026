const db = require('../config/db');

async function test() {
    console.log("--- TEST 1: /api/meetings ---");
    try {
        const res = await db.query('SELECT id, uuid, title, start_time as start, end_time as end, color, description, user_id FROM meetings WHERE deleted_at IS NULL ORDER BY start_time DESC');
        console.log("SUCCÈS. Nombre:", res.rows.length);
    } catch (e) {
        console.error("ÉCHEC:", e.message);
    }

    console.log("\n--- TEST 2: /api/admin/logs ---");
    try {
        const res = await db.query('SELECT l.*, u.username FROM system_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT $1', [10]);
        console.log("SUCCÈS. Nombre:", res.rows.length);
    } catch (e) {
        console.error("ÉCHEC:", e.message);
    }

    process.exit();
}

test();
