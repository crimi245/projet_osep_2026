require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'osep',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function fixMeetingConstraint() {
    console.log("🛠️ DÉBUT DE LA CORRECTION DE LA CONTRAINTE MEETING_TYPE...");
    
    try {
        // 1. Agrandir la taille de la colonne (partenaire_externe fait 18 caractères)
        // et cela remet la colonne properment.
        await pool.query('ALTER TABLE meetings ALTER COLUMN meeting_type TYPE VARCHAR(30);');
        console.log("✅ Taille de la colonne meeting_type augmentée (VARCHAR 30).");
        
        // 2. Supprimer l'ancienne contrainte CHECK qui bloque
        await pool.query('ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;');
        console.log("✅ Ancienne contrainte supprimée.");
        
        // 3. Ajouter la nouvelle contrainte avec tous les types possibles
        await pool.query(`
            ALTER TABLE meetings 
            ADD CONSTRAINT meetings_meeting_type_check 
            CHECK (meeting_type IN ('intra', 'inter', 'ccms', 'externe', 'codir', 'partenaire_externe', 'Autre'));
        `);
        console.log("✅ Nouvelle contrainte CHECK ajoutée avec succès !");
        
    } catch (err) {
        console.error("❌ ERREUR LORS DE LA CORRECTION :", err.message);
    } finally {
        await pool.end();
        console.log("👋 Fin du script.");
    }
}

fixMeetingConstraint();
