// Script de diagnostic pour vérifier l'état du thème dans la base de données
const db = require('../config/db');

async function checkTheme() {
    try {
        console.log('🔍 Vérification de l\'état du thème dans la base de données...\n');

        // Récupérer tous les utilisateurs et leurs thèmes
        const result = await db.query(
            "SELECT id, username, role, theme_color FROM users",
            []
        );

        console.log(' Utilisateurs dans la base de données :');
        console.log('─'.repeat(60));
        result.rows.forEach(user => {
            console.log(`ID: ${user.id} | User: ${user.username} | Role: ${user.role} | Thème: ${user.theme_color || 'NON DÉFINI'}`);
        });
        console.log('─'.repeat(60));

        // Vérifier spécifiquement l'admin
        const adminUser = result.rows.find(u => u.username === 'admin');
        if (adminUser) {
            console.log('\n👤 Utilisateur ADMIN :');
            console.log(`   Thème actuel : ${adminUser.theme_color}`);

            if (adminUser.theme_color === 'orange' || adminUser.theme_color === 'vert') {
                console.log('\n  PROBLÈME DÉTECTÉ !');
                console.log(`   Le thème est "${adminUser.theme_color}" mais devrait être "green"`);
                console.log('\n💡 Solution : Exécutez "node update_theme.js" pour corriger');
            } else if (adminUser.theme_color === 'green') {
                console.log('\n Le thème est correctement défini à "green"');
                console.log('   Si le problème persiste, vérifiez :');
                console.log('   1. Que le serveur est bien redémarré');
                console.log('   2. Le localStorage du navigateur (F12 > Application > Local Storage)');
                console.log('   3. Les logs de la console navigateur (F12 > Console)');
            }
        } else {
            console.log('\n Utilisateur admin non trouvé dans la base de données !');
        }

        process.exit(0);
    } catch (err) {
        console.error(' Erreur lors de la vérification:', err);
        process.exit(1);
    }
}

checkTheme();
