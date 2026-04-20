const db = require('./db.js');

async function testServer() {
    try {
        console.log('🧪 Testing Database Queries...\n');

        // Test 1: Get current meeting (the problematic query from line 447)
        console.log('Test 1: Current Meeting Query');
        const now = new Date().toISOString();
        const meeting = await db.query(`
            SELECT m.*, c.name as coordination_name, u.username as creator_name
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.end_time >= $1
            ORDER BY m.start_time ASC
            LIMIT 1
        `, [now]);

        if (meeting.rows.length > 0) {
            console.log('✅ Meeting found:', meeting.rows[0].title);
            console.log('   ID type:', typeof meeting.rows[0].id, '- Value:', meeting.rows[0].id);
            console.log('   UUID type:', typeof meeting.rows[0].uuid, '- Value:', meeting.rows[0].uuid);

            // Test 2: Get agenda items for this meeting
            console.log('\nTest 2: Agenda Items Query');
            const agenda = await db.query('SELECT * FROM agenda_items WHERE meeting_id = $1 ORDER BY id ASC', [meeting.rows[0].id]);
            console.log('✅ Agenda items found:', agenda.rows.length);

            // Test 3: Get attendees for this meeting
            console.log('\nTest 3: Attendees Query');
            const attendees = await db.query('SELECT * FROM attendees WHERE meeting_id = $1', [meeting.rows[0].id]);
            console.log('✅ Attendees found:', attendees.rows.length);
        } else {
            console.log('⚠️  No upcoming meetings found (this is OK if database is empty)');
        }

        // Test 4: Public UUID lookup
        console.log('\nTest 4: Public UUID Lookup');
        const publicMeeting = await db.query('SELECT * FROM meetings WHERE uuid = $1', ['fdbfc9e4-d2c1-4ccf-b835-4beba86096ac']);
        if (publicMeeting.rows.length > 0) {
            console.log('✅ Meeting found by UUID:', publicMeeting.rows[0].title);
        }

        console.log('\n✅ All tests passed! Server should work correctly now.');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Échec du test:', err.message);
        console.error(err);
        process.exit(1);
    }
}

testServer();
