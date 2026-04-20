const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/osep';
const backupDir = path.resolve(__dirname, '../backups');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `backup-osep-${timestamp}.sql`;
const filepath = path.join(backupDir, filename);

console.log(`Starting backup to ${filepath}...`);

// pg_dump command
// Note: Requires pg_dump to be in PATH or configured.
const command = `pg_dump "${dbUrl}" -f "${filepath}"`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Erreur de sauvegarde: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Stderr de sauvegarde: ${stderr}`); // pg_dump envoie souvent les infos vers stderr
    }
    console.log(`Sauvegarde terminée avec succès: ${filepath}`);
});
