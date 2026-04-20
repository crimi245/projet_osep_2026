const db = require('./db.js');

async function checkUser() {
    try {
        console.log("Checking user 'stephane'...");
        const res = await db.query("SELECT id, username, password_hash, role FROM users WHERE username = 'stephane'");
        if (res.rows.length === 0) {
            console.log("User 'stephane' NOT FOUND.");
        } else {
            const user = res.rows[0];
            console.log("User found:", user);

            try {
                const bcrypt = require('bcrypt');
                const match = await bcrypt.compare('stephane', user.password_hash);
                console.log("Password 'stephane' match:", match);
            } catch (err) {
                console.error("Bcrypt error:", err);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

checkUser();
