const db = require('../config/db');

async function testApiResponse() {
    try {
        const result = await db.query('SELECT * FROM meetings ORDER BY created_at DESC LIMIT 3');

        // Simuler la logique EXACTE du serveur
        const events = result.rows.map(row => ({
            ...row,
            start: row.start_time,
            end: row.end_time || row.start_time // valeur par défaut si end est null
        }));

        console.log("--- Réponse d'API simulée ---");
        console.log(JSON.stringify(events, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

testApiResponse();
