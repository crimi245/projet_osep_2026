const db = require('../config/db');

async function migrateMeetings() {
    console.log("Adding user_id to meetings table...");
    try {
        await db.query("ALTER TABLE meetings ADD COLUMN user_id INTEGER REFERENCES users(id)");
        console.log("Colonne user_id ajoutée avec succès.");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("La colonne user_id existe déjà.");
        } else {
            console.error("Erreur lors de l'ajout de la colonne:", err);
        }
    }
}

migrateMeetings();
