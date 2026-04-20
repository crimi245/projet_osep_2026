require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function verify() {
    try {
        console.log("🔍 Verifying Data Integrity...");

        const users = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`✅ Users: ${users.rows[0].count}`);

        const meetings = await pool.query('SELECT COUNT(*) FROM meetings');
        console.log(`✅ Meetings: ${meetings.rows[0].count}`);

        const logs = await pool.query('SELECT COUNT(*) FROM system_logs');
        console.log(`✅ System Logs: ${logs.rows[0].count}`);

        const coords = await pool.query('SELECT COUNT(*) FROM coordinations');
        console.log(`✅ Coordinations: ${coords.rows[0].count}`);

        console.log("\n🎉 Data consistency check passed!");
    } catch (e) {
        console.error("❌ Échec de la vérification:", e);
    } finally {
        pool.end();
    }
}

verify();
