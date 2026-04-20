const db = require('../config/db');
const bcrypt = require('bcrypt');

(async () => {
    try {
        // Generate new hash for 'admin'
        const hash = await bcrypt.hash('admin', 10);
        console.log('Generated Hash:', hash);

        // Force update
        await db.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
        console.log('SUCCESS: Admin password reset to "admin".');
    } catch (err) {
        console.error('ERROR:', err);
    }
})();
