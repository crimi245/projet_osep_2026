require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'osep_db',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT || 5432,
});

async function backupDatabase() {
  try {
    console.log("Démarrage de la sauvegarde de la base de données...");
    
    // Obtenir toutes les tables publiques
    const tablesQuery = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    const tables = tablesQuery.rows.map(row => row.tablename);
    const backupData = {};
    
    for (const table of tables) {
      console.log(`Sauvegarde de la table: ${table}...`);
      const res = await pool.query(`SELECT * FROM ${table}`);
      backupData[table] = res.rows;
    }
    
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)){
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `osep_db_backup_${timestamp}.json`);
    
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`Sauvegarde terminée avec succès. Fichier créé: ${backupPath}`);
  } catch (err) {
    console.error("Erreur lors de la sauvegarde :", err);
  } finally {
    pool.end();
  }
}

backupDatabase();
