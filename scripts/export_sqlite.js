const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../osep.db');
const outputPath = path.resolve(__dirname, '../data_backup.json');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Erreur de connexion à SQLite:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database.');
});

async function exportData() {
    const backup = {};

    // Get all tables
    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";

    db.all(tablesQuery, [], async (err, tables) => {
        if (err) {
            console.error('Erreur lors de la récupération des tables:', err);
            process.exit(1);
        }

        const promises = tables.map(table => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
                    if (err) reject(err);
                    else {
                        backup[table.name] = rows;
                        console.log(`Exported ${rows.length} rows from ${table.name}`);
                        resolve();
                    }
                });
            });
        });

        try {
            await Promise.all(promises);
            fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));
            console.log(`\nSauvegarde enregistrée avec succès dans ${outputPath}`);
            process.exit(0);
        } catch (error) {
            console.error('Erreur lors de l\'exportation des données au niveau des tables:', error);
            process.exit(1);
        }
    });
}

exportData();
