// Test de connexion avec le paramètre de thème (comme le frontend l'envoie)
const http = require('http');

const postData = JSON.stringify({
    username: 'admin',
    password: 'admin',
    theme: 'green'  // Ajouter le thème comme le frontend le fait
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('🧪 Test de connexion avec theme (comme le frontend)...\n');
console.log('Données envoyées:', JSON.parse(postData));

const req = http.request(options, (res) => {
    console.log('\n📡 Réponse du serveur:');
    console.log('Status:', res.statusCode);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n📦 Corps de la réponse:');
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));

            if (parsed.success) {
                console.log('\n✅ CONNEXION RÉUSSIE AVEC THEME!');
                console.log('👤 Utilisateur:', parsed.user.username);
                console.log('🎨 Theme:', parsed.user.theme_color);
                console.log('\n🎉 Le frontend devrait maintenant fonctionner!');
            } else if (parsed.error) {
                console.log('\n❌ ÉCHEC!');
                console.log('Erreur:', parsed.error);
            }
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error('\n❌ Erreur:', e.message);
});

req.write(postData);
req.end();
