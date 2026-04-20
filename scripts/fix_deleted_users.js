const db = require('../config/db');

async function fixDeletedUsers() {
    try {
        console.log('Renommage des utilisateurs supprimés...');
        const result = await db.query(`
            UPDATE users 
            SET username = SUBSTRING(username FROM 1 FOR 70) || '_del_' || id 
            WHERE deleted_at IS NOT NULL 
            AND username NOT LIKE '%_del_%'
        `);
        console.log(`${result.rowCount} utilisateurs supprimés ont été renommés.`);
        process.exit(0);
    } catch (err) {
        console.error('Erreur:', err);
        process.exit(1);
    }
}

fixDeletedUsers();
