
const db = require('../config/db');
const http = require('http');

async function test() {
    try {
        console.log("Fetching a VALID UUID (any meeting)...");
        // Get a meeting that is definitely in the past to test redirect
        // Or get any meeting and see what happens
        const res = await db.query('SELECT uuid, start_time, end_time FROM meetings LIMIT 1');
        if (res.rows.length === 0) {
            console.log("No meetings found in DB.");
            return;
        }
        const m = res.rows[0];
        console.log(`Found UUID: ${m.uuid}`);
        console.log(`Start: ${m.start_time} | End: ${m.end_time}`);

        // Test Request
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/m/${m.uuid}/form1`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            if (res.statusCode === 302) {
                console.log(`REDIRECT TO: ${res.headers.location}`);
            }
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                // console.log(`BODY: ${chunk.substring(0, 100)}...`); 
            });
        });

        req.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
        });

        req.end();

    } catch (e) {
        console.error(e);
    }
}

test();
