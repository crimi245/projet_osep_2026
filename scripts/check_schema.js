const db = require('./db.js');

async function checkSchema() {
    try {
        // Check meetings table structure
        const meetingsSchema = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'meetings' 
            AND column_name IN ('id', 'uuid')
            ORDER BY column_name
        `);

        console.log('=== MEETINGS TABLE SCHEMA ===');
        console.log(meetingsSchema.rows);

        // Check agenda_items table structure
        const agendaSchema = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'agenda_items' 
            AND column_name = 'meeting_id'
        `);

        console.log('\n=== AGENDA_ITEMS TABLE SCHEMA ===');
        console.log(agendaSchema.rows);

        // Check if there are any meetings
        const meetings = await db.query('SELECT id, uuid FROM meetings LIMIT 3');
        console.log('\n=== SAMPLE MEETINGS ===');
        console.log(meetings.rows);
        console.log('ID type:', typeof meetings.rows[0]?.id);
        console.log('UUID type:', typeof meetings.rows[0]?.uuid);

        process.exit(0);
    } catch (err) {
        console.error('Erreur:', err);
        process.exit(1);
    }
}

checkSchema();
