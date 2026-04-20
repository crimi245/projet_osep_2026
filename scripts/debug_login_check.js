const db = require('./db.js');
const bcrypt = require('bcrypt');

async function debugLogin() {
    const username = 'stephane';
    const password = 'stephane';

    console.log(`--- DEBUGGING LOGIN FOR: ${username} ---`);

    try {
        // 1. Get User
        console.log("1. Fetching user...");
        const res = await db.query(`SELECT id, username, password_hash, role FROM users WHERE username = $1`, [username]);

        if (res.rows.length === 0) {
            console.error("❌ User not found!");
            process.exit(1);
        }
        const user = res.rows[0];
        console.log("✅ User found:", user.id, user.role);

        // 2. Check Password
        console.log("2. Checking password...");
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.error("❌ Password mismatch!");
            process.exit(1);
        }
        console.log("✅ Password correct.");

        // 3. Insert Login Log
        console.log("3. Inserting into login_logs...");
        const deviceType = 'desktop';
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'; // Standard string
        const ip = '127.0.0.1';

        try {
            await db.query(
                'INSERT INTO login_logs (user_id, device_type, user_agent, ip_address, login_time) VALUES ($1, $2, $3, $4, NOW())',
                [user.id, deviceType, userAgent, ip]
            );
            console.log("✅ Login log inserted successfully.");
        } catch (dbErr) {
            console.error("❌ FAILED to insert login log:", dbErr.message);
            console.error("   Detail:", dbErr);
        }

    } catch (err) {
        console.error("❌ Unexpected error:", err);
    } finally {
        // process.exit(0); // Don't exit immediately to allow async logs if any
        setTimeout(() => process.exit(0), 1000);
    }
}

debugLogin();
