const db = require('../config/db');

async function checkAT() {
    try {
        const res = await db.query("SELECT id, username, password_hash, role FROM users WHERE username = 'AT'");
        if (res.rows.length === 0) {
            console.log("User AT not found!");
        } else {
            const user = res.rows[0];
            console.log("User found:", user);
            console.log("Hash starts with:", user.password_hash.substring(0, 7));
            if (!user.password_hash.startsWith('$2b$')) {
                console.log("WARNING: Hash does not look like valid bcrypt!");
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAT();
