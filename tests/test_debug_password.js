const http = require('http');

function postRequest(path, data, cookie) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3000,
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

function putRequest(path, data, cookie) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'PUT',
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

const run = async () => {
    try {
        console.log('1. Connexion en tant qu\'admin...');
        let loginRes = await postRequest('/api/auth/login', { username: 'admin', password: 'password' });
        if (loginRes.statusCode !== 200) {
            loginRes = await postRequest('/api/auth/login', { username: 'admin', password: 'admin' });
        }

        if (loginRes.statusCode !== 200) {
            console.error('Échec de la connexion:', loginRes.body);
            return;
        }

        console.log('Connexion réussie.');
        const cookieHeader = loginRes.headers['set-cookie'];
        const cookie = Array.isArray(cookieHeader) ? cookieHeader[0].split(';')[0] : cookieHeader.split(';')[0];


        const userId = 28; // Cible 'AT'
        console.log(`Ciblage de l'ID utilisateur: ${userId}`);

        // Mettre à jour le mot de passe
        console.log('3. Tentative de mise à jour du mot de passe pour AT...');
        const updateRes = await putRequest(`/api/users/${userId}`, {
            password: 'newPasswordAT123',
            // Envoyer les autres champs comme le fait le frontend ?
            // Le frontend envoie : { username, password, role, full_name, coordination_id, gender }
            // Mais s'il s'agit d'une modification, il pourrait n'envoyer qu'une partie.
            // Envoyons ce que le frontend envoie.
            // username: 'AT', // frontend supprime le nom d'utilisateur

            role: 'admin',
            full_name: 'AT',
            coordination_id: null,
            gender: 'M'
        }, cookie);

        console.log(`Statut de la mise à jour: ${updateRes.statusCode}`);
        console.log(`Corps de la mise à jour: ${updateRes.body}`);

    } catch (err) {
        console.error('Erreur du script:', err);
    }
};

run();
