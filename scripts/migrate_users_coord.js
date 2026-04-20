const db = require('../config/db');

async function migrate() {
    console.log("Adding coordination_id to users table...");
    try {
        await db.query("ALTER TABLE users ADD COLUMN coordination_id INTEGER REFERENCES coordinations(id)");
        console.log("Colonne coordination_id ajoutée avec succès.");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("La colonne existe déjà.");
        } else {
            console.error("Erreur lors de l'ajout de la colonne:", err);
        }
    }
}

migrate();
