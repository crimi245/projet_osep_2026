require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function init() {
    try {
        const schemaPath = path.join(__dirname, 'schema_pg.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Exécution du schéma SQL (PostgreSQL)...');
        await db.exec(schemaSql);

        console.log('Base de données initialisée avec succès !');
        process.exit(0);
    } catch (err) {
        console.error('Erreur lors de l\'initialisation :', err);
        process.exit(1);
    }
}

init();
