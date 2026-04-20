require('dotenv').config();
const db = require('../config/db');

async function checkDatabase() {
    try {
        console.log('🔍 Vérification de l\'état de la base de données PostgreSQL...\n');

        // Test connection
        console.log('1. Test de connexion...');
        await db.query('SELECT NOW()');
        console.log(' Connexion PostgreSQL OK\n');

        // Check if users table exists
        console.log('2. Vérification de la table users...');
        const tableCheck = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log(' La table users n\'existe pas!');
            console.log('\n Vous devez initialiser la base de données:');
            console.log('   node init_db.js\n');
            process.exit(1);
        }

        console.log(' Table users existe\n');

        // Check table structure
        console.log('3. Structure de la table users...');
        const structure = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);

        console.log('Colonnes:');
        structure.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        // Count users
        console.log('\n4. Nombre d\'utilisateurs...');
        const userCount = await db.query('SELECT COUNT(*) as count FROM users');
        console.log(`   Total: ${userCount.rows[0].count} utilisateurs\n`);

        if (userCount.rows[0].count > 0) {
            console.log('5. Liste des utilisateurs:');
            const users = await db.query('SELECT id, username, role, full_name FROM users LIMIT 10');
            users.rows.forEach(u => {
                console.log(`   - ${u.username} (${u.role}) - ${u.full_name} [ID: ${u.id}]`);
            });
        } else {
            console.log('  Aucun utilisateur trouvé! Vous devez créer un admin.');
            console.log('   Exécutez: node reset_admin.js\n');
        }

        // Check other tables
        console.log('\n6. Autres tables...');
        const tables = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        console.log('Tables existantes:');
        tables.rows.forEach(t => {
            console.log(`   - ${t.table_name}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('\n ERREUR:', err.message);
        console.error('\nDétails:', err);

        if (err.message.includes('does not exist')) {
            console.log('\n💡 Solution: Initialisez la base de données avec:');
            console.log('   node init_db.js');
        } else if (err.message.includes('connect')) {
            console.log('\n💡 Solution: Vérifiez que PostgreSQL est démarré et que les paramètres .env sont corrects');
        }

        process.exit(1);
    }
}

checkDatabase();
