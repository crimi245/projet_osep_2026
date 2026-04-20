// Script pour mettre à jour le thème de l'utilisateur admin à 'green'
const db = require('../config/db');

async function updateAdminTheme() {
    try {
        // Mettre à jour le thème de l'utilisateur admin à 'green'
        const result = await db.query(
            "UPDATE users SET theme_color = 'green' WHERE username = 'admin'",
            []
        );

        console.log(' Thème de l\'utilisateur admin mis à jour vers "green"');

        // Vérifier la mise à jour
        const check = await db.query(
            "SELECT username, theme_color FROM users WHERE username = 'admin'",
            []
        );

        console.log('Vérification:', check.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error(' Erreur lors de la mise à jour:', err);
        process.exit(1);
    }
}

updateAdminTheme();
