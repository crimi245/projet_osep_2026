const db = require('../config/db');

async function migrateAttendees() {
    console.log("Adding meeting_id to attendees table...");
    try {
        await db.query("ALTER TABLE attendees ADD COLUMN meeting_id INTEGER REFERENCES meetings(id)");
        console.log("Colonne meeting_id ajoutée avec succès.");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("La colonne meeting_id existe déjà.");
        } else {
            console.error("Erreur lors de l'ajout de la colonne:", err);
        }
    }
}

migrateAttendees();
