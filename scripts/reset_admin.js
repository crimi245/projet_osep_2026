require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function resetAdminPassword() {
    try {
        console.log('🔐 Réinitialisation du mot de passe admin...');

        // Generate new password hash for "admin"
        const password = 'admin';
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        console.log('Nouveau hash généré:', passwordHash);

        // Update or insert admin user
        const result = await db.query(`
            INSERT INTO users (username, password_hash, role, full_name, theme_color, gender)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username) 
            DO UPDATE SET password_hash = $2
        `, ['admin', passwordHash, 'admin', 'Administrateur', 'green', 'M']);

        console.log('✅ Mot de passe admin réinitialisé avec succès!');
        console.log('\nLogins de connexion:');
        console.log('Username: admin');
        console.log('Password: admin');

        // Verify the user exists
        const check = await db.query('SELECT username, role, full_name FROM users WHERE username = $1', ['admin']);
        if (check.rows.length > 0) {
            console.log('\n✓ Utilisateur trouvé dans la base:', check.rows[0]);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Erreur lors de la réinitialisation:', err.message);
        console.error('Détails:', err);
        process.exit(1);
    }
}

resetAdminPassword();
