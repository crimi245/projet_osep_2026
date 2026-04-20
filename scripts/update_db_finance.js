const { Client } = require('pg');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'osep_db',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
};

async function updateDb() {
    const client = new Client(config);
    try {
        await client.connect();

        console.log("Ajout de la colonne montant...");
        await client.query("ALTER TABLE attendees ADD COLUMN IF NOT EXISTS montant DECIMAL(10, 2);");

        console.log("Ajout de la colonne signature_finale...");
        await client.query("ALTER TABLE attendees ADD COLUMN IF NOT EXISTS signature_finale BOOLEAN DEFAULT FALSE;");

        console.log("Ajout de la colonne statut_finance...");
        await client.query("ALTER TABLE attendees ADD COLUMN IF NOT EXISTS statut_finance VARCHAR(50) DEFAULT 'En attente';");

        console.log("Mise à jour terminée avec succès.");
    } catch (err) {
        console.error('Erreur lors de la mise à jour de la base de données:', err);
    } finally {
        await client.end();
    }
}

updateDb();
