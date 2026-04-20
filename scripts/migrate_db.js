const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'osep.db');
const db = new sqlite3.Database(dbPath);

const createTableSQL = `
CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device_type TEXT, -- 'desktop', 'mobile'
    user_agent TEXT,
    ip_address TEXT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

db.serialize(() => {
    db.run(createTableSQL, (err) => {
        if (err) {
            console.error("Erreur de migration:", err.message);
        } else {
            console.log("Succès de migration: table login_logs créée.");
        }
    });
});

db.close();
