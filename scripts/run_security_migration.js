// Script pour exécuter la migration de sécurité
const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runSecurityMigration() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'osep_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD
    });

    try {
        await client.connect();
        console.log('✅ Connecté à PostgreSQL');

        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, 'migrations', 'create_security_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔄 Exécution de la migration de sécurité...');
        await client.query(sql);

        console.log('✅ Migration de sécurité terminée avec succès !');
        console.log('');
        console.log('Tables créées :');
        console.log('  - ip_blacklist (avec expiration automatique)');
        console.log('  - threat_patterns (17 patterns pré-configurés)');
        console.log('  - quarantine_payloads');
        console.log('  - security_events');
        console.log('  - security_config');

    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runSecurityMigration();
