require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Starting migration to UUID...");

        await client.query('BEGIN');

        // 0. Enable pgcrypto
        console.log("Enabling pgcrypto...");
        await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

        // 1. Add UUID column
        console.log("Adding meeting_uuid column...");
        await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_uuid UUID DEFAULT gen_random_uuid();');

        // 2. Link attendees (and others if any)
        // Check if attendees table exists first to avoid errors if empty DB
        console.log("Updating attendees link...");
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE  table_schema = 'public'
                AND    table_name   = 'attendees'
            );
        `);

        if (res.rows[0].exists) {
            await client.query('ALTER TABLE attendees ADD COLUMN IF NOT EXISTS meeting_link_uuid UUID;');

            // Only update if there are rows
            await client.query(`
                UPDATE attendees 
                SET meeting_link_uuid = m.meeting_uuid 
                FROM meetings m 
                WHERE attendees.meeting_id = m.id
                AND attendees.meeting_link_uuid IS NULL;
            `);

            // Drop old constraint and column
            // We need to know the constraint name, often attendees_meeting_id_fkey
            // But let's try dropping constraint safely if we can, or just drop column cascade? Use with caution.
            // Better to rename and drop constraint by name if known. standard is table_col_fkey

            console.log("Swapping columns in attendees...");
            try {
                await client.query('ALTER TABLE attendees DROP CONSTRAINT IF EXISTS attendees_meeting_id_fkey;');
            } catch (e) { console.log("Constraint might be named differently, continuing...", e.message); }

            await client.query('ALTER TABLE attendees DROP COLUMN IF EXISTS meeting_id;');
            await client.query('ALTER TABLE attendees RENAME COLUMN meeting_link_uuid TO meeting_id;');

            // Add new constraint
            // We need to wait until meetings PK is swapped
        }

        // 3. Finalize meetings table
        console.log("Swapping columns in meetings...");
        await client.query('ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_pkey CASCADE;');
        await client.query('ALTER TABLE meetings DROP COLUMN IF EXISTS id;');
        await client.query('ALTER TABLE meetings RENAME COLUMN meeting_uuid TO id;');
        await client.query('ALTER TABLE meetings ADD PRIMARY KEY (id);');

        // 4. Re-add FK constraint to attendees
        if (res.rows[0].exists) {
            console.log("Restoring attendees FK...");
            await client.query('ALTER TABLE attendees ADD CONSTRAINT attendees_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id);');
        }

        await client.query('COMMIT');
        console.log("Migration réussie !");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Échec de la migration:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
