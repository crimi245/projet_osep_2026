const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const backupPath = path.resolve(__dirname, '../data_backup.json');

if (!process.env.DATABASE_URL && !process.env.DB_USER) {
    console.warn("WARNING: Database credentials not found in .env, using defaults.");
}

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'osep',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
    };

const pool = new Pool(poolConfig);

async function importData() {
    try {
        if (!fs.existsSync(backupPath)) {
            console.error(`Fichier de sauvegarde introuvable dans ${backupPath}`);
            process.exit(1);
        }

        const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const tables = Object.keys(data);

        console.log(`Found data for tables: ${tables.join(', ')}`);

        // Order matters for Foreign Keys! 
        // We should disable triggers or constraints temporarily OR insert in correct order.
        // Hierarchy: coordinations -> users -> meetings -> (attendees, agenda_items, coordination_members)
        // Simple approach: efficient one-by-one with intelligent ordering or try/catch retry (bad) or disable constraints.
        // PostgreSQL: SET session_replication_role = 'replica'; disables triggers/FK checks.

        await pool.query("SET session_replication_role = 'replica';");

        for (const table of tables) {
            const rows = data[table];
            if (rows.length === 0) continue;

            console.log(`Importation de ${rows.length} lignes dans ${table}...`);

            // Generate INSERT statement
            const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');

            for (const row of rows) {
                const values = Object.values(row);
                // Parametrized query construction
                const indices = values.map((_, i) => `$${i + 1}`).join(', ');
                const query = `INSERT INTO "${table}" (${columns}) VALUES (${indices}) ON CONFLICT DO NOTHING`; // Safety

                try {
                    await pool.query(query, values);
                } catch (err) {
                    console.error(`Échec de l'insertion dans ${table}:`, row, err.message);
                }
            }
        }

        await pool.query("SET session_replication_role = 'origin';");

        // Réinitialiser les séquences (Important car nous avons inséré des IDs explicites)
        // For each table with ID, set sequence to max(id)
        for (const table of tables) {
            const hasId = data[table][0] && data[table][0].hasOwnProperty('id');
            if (hasId) {
                try {
                    // Check if sequence exists (usually table_id_seq)
                    await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1) ) FROM "${table}"`);
                    console.log(`Updated sequence for ${table}`);
                } catch (seqErr) {
                    // Ignore if no sequence (e.g. no serial)
                }
            }
        }

        console.log('Importation terminée avec succès !');
        process.exit(0);

    } catch (err) {
        console.error('Échec de l\'importation:', err);
        process.exit(1);
    }
}

importData();
