const db = require('../config/db');
const fs = require('fs');

async function migrateGender() {
    console.log("Adding gender to users table...");
    try {
        await db.query("ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'M'");
        console.log("Colonne gender ajoutée avec succès.");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("La colonne existe déjà.");
        } else {
            console.error("Erreur lors de l'ajout de la colonne:", err);
        }
    }
}

migrateGender();
