const http = require('http');

function postRequest(path, data, cookie) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        if (cookie) options.headers['Cookie'] = cookie;

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: responseData }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function getRequest(path, cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET',
            headers: {}
        };
        if (cookie) options.headers['Cookie'] = cookie;

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: responseData }));
        });
        req.on('error', reject);
        req.end();
    });
}

const run = async () => {
    try {
        console.log('Test sur le port 3001...');

        let loginRes = await postRequest('/api/auth/login', { username: 'admin', password: 'password' });

        if (loginRes.statusCode !== 200) {
            console.log('Échec de la connexion avec "password", essai avec "admin"...');
            loginRes = await postRequest('/api/auth/login', { username: 'admin', password: 'admin' });
        }

        if (loginRes.statusCode !== 200) {
            console.error('Échec de la connexion:', loginRes.body);
            return;
        }

        console.log('Connexion réussie.');
        // Gérer le tableau ou la chaîne de cookies
        const cookieHeader = loginRes.headers['set-cookie'];
        const cookie = Array.isArray(cookieHeader) ? cookieHeader[0].split(';')[0] : cookieHeader.split(';')[0];

        console.log('2. Récupération des réunions...');
        const meetingsRes = await getRequest('/api/meetings', cookie);

        if (meetingsRes.statusCode !== 200) {
            console.error('Échec de la récupération:', meetingsRes.statusCode, meetingsRes.body);
            return;
        }

        console.log('Réponse des réunions:');
        const meetings = JSON.parse(meetingsRes.body);
        console.log(JSON.stringify(meetings.slice(0, 2), null, 2));

    } catch (err) {
        console.error(err);
    }
};

run();
