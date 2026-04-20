require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function testLogin() {
    try {
        console.log('🔍 Test de connexion admin...\n');

        // Étape 1 : Vérifier si l'utilisateur admin existe
        console.log('1. Verification de l\'utilisateur admin...');
        const userCheck = await db.query(
            'SELECT username, role, full_name, password_hash FROM users WHERE username = $1',
            ['admin']
        );

        if (userCheck.rows.length === 0) {
            console.log('❌ ERREUR: L\'utilisateur admin n\'existe pas!');
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log('✅ Utilisateur trouvé:');
        console.log('   - Nom d\'utilisateur:', user.username);
        console.log('   - Rôle:', user.role);
        console.log('   - Nom complet:', user.full_name);
        console.log('   - Hachage:', user.password_hash.substring(0, 20) + '...');

        // Étape 2 : Tester la comparaison du mot de passe
        console.log('\n2. Test de la comparaison du mot de passe...');
        const testPassword = 'admin';
        const match = await bcrypt.compare(testPassword, user.password_hash);

        if (match) {
            console.log('✅ Le mot de passe "admin" correspond au hash stocké!');
            console.log('\n🎉 LA CONNEXION DEVRAIT FONCTIONNER!');
            console.log('\nUtilisez:');
            console.log('   Nom d\'utilisateur: admin');
            console.log('   Mot de passe: admin');
        } else {
            console.log('❌ Le mot de passe "admin" ne correspond PAS au hash stocké!');
            console.log('\n🔧 Réinitialisation du mot de passe...');

            const newHash = await bcrypt.hash('admin', 10);
            await db.query(
                'UPDATE users SET password_hash = $1 WHERE username = $2',
                [newHash, 'admin']
            );

            console.log('✅ Mot de passe réinitialisé à "admin"');
        }

        //Étape 3 : Tester si la coordination existe (champ optionnel)
        console.log('\n3. Vérification de la coordination...');
        if (user.coordination_id) {
            const coordCheck = await db.query(
                'SELECT name FROM coordinations WHERE id = $1',
                [user.coordination_id]
            );
            console.log('   Coordination:', coordCheck.rows[0]?.name || 'Non trouvée');
        } else {
            console.log('   Pas de coordination assignée (normal pour admin)');
        }

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Erreur:', err.message);
        console.error('Détails:', err);
        process.exit(1);
    }
}

testLogin();
