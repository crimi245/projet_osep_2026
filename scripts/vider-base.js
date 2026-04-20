const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'osep',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function viderBaseDeDonnees() {
    console.log("⚠️ DÉBUT DU NETTOYAGE DES DONNÉES DE L'APPLICATION (Sauf Utilisateurs)...");
    
    const args = process.argv.slice(2);
    if (!args.includes('--confirmer')) {
        console.log("\n⚠️ ATTENTION : Ce script va vider les données de réunions, logs, etc.");
        console.log("   Vos comptes utilisateurs et vos coordinations SERONT CONSERVÉS.");
        console.log("\n➡️ Pour exécuter ce script en toute sécurité, lancez la commande suivante :");
        console.log("\n   node scripts/vider-base.js --confirmer\n");
        process.exit(0);
    }

    try {
        // 1. Récupérer toutes les tables du schéma public SAUF les configuration de base
        const res = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename NOT IN ('users', 'coordinations', 'coordination_members')
        `);
        
        const tables = res.rows.map(row => row.tablename);
        
        if (tables.length === 0) {
            console.log("ℹ️ Aucune table à vider.");
            process.exit(0);
        }

        console.log(`\n🗑️ ${tables.length} tables trouvées et prêtes à être vidées (utilisateurs protégés) :`);
        console.log(`   - ${tables.join(', ')}`);
        
        // 2. Construire la commande TRUNCATE géante avec CASCADE
        const queryTruncate = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} CASCADE;`;
        
        console.log("\n⏳ Exécution de la suppression CASCADE pour tout nettoyer d'un coup...");
        await pool.query(queryTruncate);
        
        console.log("\n✅ SUCCÈS : Les réunions, participants et journaux ont été supprimés !");
        console.log("🛡️ Vos comptes utilisateurs (users) et vos coordinations (coordinations) ont été PARFAITEMENT PRÉSERVÉS.");
        console.log("\n💡 Vous pouvez maintenant déployer votre application : vos comptes admin fonctionnent toujours !");
        
    } catch (err) {
        console.error("\n❌ ERREUR LORS DU NETTOYAGE DE LA BASE DE DONNÉES :", err.message);
    } finally {
        await pool.end();
        console.log("\n👋 Fin du script.");
        process.exit(0);
    }
}

viderBaseDeDonnees();
