const db = require('../config/db');
const { randomUUID } = require('crypto');

async function createTestMeetings() {
    try {
        const userId = 1; // Assuming admin user ID 1 exists
        console.log("Cleaning up old test meetings...");
        await db.query("DELETE FROM meetings WHERE description = 'TEST_REDIRECTION'");

        const now = new Date();

        // 1. PAST MEETING (Yesterday)
        const pastStart = new Date(now.getTime() - 25 * 60 * 60 * 1000); // -25h
        const pastEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);   // -24h
        const pastUuid = randomUUID();

        await db.query(`
            INSERT INTO meetings (title, start_time, end_time, description, uuid, user_id, coordination_id)
            VALUES ('TEST PAST', $1, $2, 'TEST_REDIRECTION', $3, $4, 1)
        `, [pastStart, pastEnd, pastUuid, userId]);

        console.log(`PAST Meeting Created: UUID=${pastUuid}`);
        console.log(`EXPECT: Redirect to /print (Receipt)`);
        console.log(`TEST CMD: curl -I http://localhost:3000/m/${pastUuid}`);

        // 2. FUTURE MEETING (Tomorrow)
        const futureStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
        const futureEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // +25h
        const futureUuid = randomUUID();

        await db.query(`
            INSERT INTO meetings (title, start_time, end_time, description, uuid, user_id, coordination_id)
            VALUES ('TEST FUTURE', $1, $2, 'TEST_REDIRECTION', $3, $4, 1)
        `, [futureStart, futureEnd, futureUuid, userId]);

        console.log(`FUTURE Meeting Created: UUID=${futureUuid}`);
        console.log(`EXPECT: Waiting Room (meeting-waiting.html)`);
        console.log(`TEST CMD: curl -I http://localhost:3000/m/${futureUuid}`);

        // 3. PRESENT MEETING (Now)
        const presentStart = new Date(now.getTime() - 5 * 60 * 1000); // Started 5 mins ago
        const presentEnd = new Date(now.getTime() + 55 * 60 * 1000);  // Ends in 55 mins
        const presentUuid = randomUUID();

        await db.query(`
            INSERT INTO meetings (title, start_time, end_time, description, uuid, user_id, coordination_id)
            VALUES ('TEST PRESENT', $1, $2, 'TEST_REDIRECTION', $3, $4, 1)
        `, [presentStart, presentEnd, presentUuid, userId]);

        console.log(`PRESENT Meeting Created: UUID=${presentUuid}`);
        console.log(`EXPECT: Entry (osep.html)`);
        console.log(`TEST CMD: curl -I http://localhost:3000/m/${presentUuid}`);

    } catch (e) {
        console.error("Error creating tests:", e);
    }
}

createTestMeetings();
