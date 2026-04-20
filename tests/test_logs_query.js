const db = require('../config/db');

async function testLogsAll() {
    try {
        console.log("Test de la requête /api/admin/logs/all...");

        const action = '';
        const user = '';
        const level = '';
        const limit = 100;

        let query = `
            SELECT l.*, u.username, u.full_name 
            FROM system_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            WHERE 1=1
        `;
        let params = [];
        let pIdx = 1;

        query += ` ORDER BY l.created_at DESC LIMIT $${pIdx}`;
        params.push(limit);

        console.log("Requête:", query);
        console.log("Paramètres:", params);

        const result = await db.query(query, params);
        console.log("Succès! Lignes:", result.rows.length);
        if (result.rows.length > 0) {
            console.log("Échantillon:", result.rows[0]);
        }

    } catch (err) {
        console.error("ÉCHEC:", err.message);
    }
    process.exit();
}

testLogsAll();
