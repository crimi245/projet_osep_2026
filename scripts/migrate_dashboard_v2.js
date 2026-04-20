const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'osep.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Add location and user_id to meetings if not exist
    db.run("ALTER TABLE meetings ADD COLUMN location TEXT", (err) => {
        if (err && !err.message.includes('duplicate column')) console.log("Location col exists or error", err.message);
        else console.log("Colonne location ajoutée");
    });

    db.run("ALTER TABLE meetings ADD COLUMN user_id INTEGER REFERENCES users(id)", (err) => {
        if (err && !err.message.includes('duplicate column')) console.log("user_id col exists or error", err.message);
        else console.log("Colonne user_id ajoutée");
    });

    // 2. Create Agenda Items Table
    db.run(`CREATE TABLE IF NOT EXISTS agenda_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, done
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("Agenda table error", err);
        else console.log("Table agenda créée");
    });
});

db.close();
