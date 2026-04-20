const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function runMigration() {
    try {
        console.log("Démarrage de la migration de la table meetings (Géorepérage)...");

        // Ajout des colonnes de géolocalisation
        await pool.query(`
            ALTER TABLE meetings
            ADD COLUMN IF NOT EXISTS geo_lat DECIMAL(9,6) DEFAULT 5.359951,
            ADD COLUMN IF NOT EXISTS geo_lon DECIMAL(9,6) DEFAULT -4.008256,
            ADD COLUMN IF NOT EXISTS geo_radius INTEGER DEFAULT 1000;
        `);
        console.log("✅ Colonnes geo_lat, geo_lon, geo_radius ajoutées avec succès (Defaut: Abidjan, 1000m).");

    } catch (err) {
        console.error("❌ Erreur pendant la migration :", err);
    } finally {
        await pool.end();
    }
}

runMigration();
