// Script de récupération du server.js depuis le processus Node.js en cours
const http = require('http');

// On va créer une requête spéciale pour extraire le code source
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/user/me', // Une route qui existe
    method: 'GET'
};

console.log('Tentative de connexion au serveur pour vérifier qu\'il tourne...');

const req = http.request(options, (res) => {
    console.log(`Serveur répond avec le code: ${res.statusCode}`);
    console.log('Le serveur est bien en cours d\'exécution.');
    console.log('\nMalheureusement, on ne peut pas extraire le code source directement depuis HTTP.');
    console.log('Solution: Je vais recréer le fichier server.js manuellement avec le contenu correct.');
});

req.on('error', (e) => {
    console.error(`Erreur: ${e.message}`);
    console.log('Le serveur ne semble pas répondre.');
});

req.end();
