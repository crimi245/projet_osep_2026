
const db = require('../config/db');

async function checkRoles() {
    try {
        const res = await db.query("SELECT DISTINCT role, COUNT(*) FROM users WHERE deleted_at IS NULL GROUP BY role");
        console.log("Roles found:", res.rows);
    } catch (err) {
        console.error("Error:", err);
    }
}

checkRoles();
