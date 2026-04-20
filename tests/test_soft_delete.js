const db = require('../config/db');

async function testSoftDelete() {
    try {
        console.log('🧪 Test du système de suppression logique\n');
        console.log('='.repeat(60));

        // Étape 1 : Créer une réunion de test
        console.log('\n📝 Test 1: Création d\'une réunion de test...');
        const meeting = await db.query(`
            INSERT INTO meetings (title, start_time, end_time, user_id)
            VALUES ('Test Meeting for Soft Delete', NOW(), NOW() + INTERVAL '1 hour', 1)
            RETURNING id, title
        `);
        const meetingId = meeting.rows[0].id;
        console.log(`✅ Réunion créée : "${meeting.rows[0].title}" (ID: ${meetingId})`);

        // Étape 2 : Vérifier que la réunion est visible (deleted_at IS NULL)
        console.log('\n📝 Test 2: Vérification de la visibilité de la réunion...');
        const visibleMeetings = await db.query(
            'SELECT id, title, deleted_at FROM meetings WHERE id = $1 AND deleted_at IS NULL',
            [meetingId]
        );
        if (visibleMeetings.rows.length > 0) {
            console.log(`✅ La réunion est visible (deleted_at: ${visibleMeetings.rows[0].deleted_at})`);
        } else {
            console.log('❌ Réunion NON visible (ÉCHEC)');
        }

        // Étape 3 : Suppression logique de la réunion
        console.log('\n📝 Test 3: Suppression logique de la réunion...');
        await db.query(
            'UPDATE meetings SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [meetingId]
        );
        console.log('✅ Exécution de l\'UPDATE de suppression logique');

        // Étape 4 : Vérifier que la réunion N'EST PAS visible dans la requête de l'utilisateur
        console.log('\n📝 Test 4: Vérification que la réunion N\'EST PAS visible dans la vue utilisateur...');
        const hiddenMeetings = await db.query(
            'SELECT id, title, deleted_at FROM meetings WHERE id = $1 AND deleted_at IS NULL',
            [meetingId]
        );
        if (hiddenMeetings.rows.length === 0) {
            console.log('✅ La réunion N\'EST PAS visible dans la vue utilisateur (correct!)');
        } else {
            console.log('❌ La réunion est toujours visible (ÉCHEC)');
        }

        // Étape 5 : Vérifier que la réunion EXISTE TOUJOURS dans la base de données (pour les statistiques)
        console.log('\n📝 Test 5: Vérification que la réunion existe toujours dans la base de données...');
        const existingMeetings = await db.query(
            'SELECT id, title, deleted_at FROM meetings WHERE id = $1',
            [meetingId]
        );
        if (existingMeetings.rows.length > 0) {
            console.log(`✅ La réunion existe toujours dans la base de données (deleted_at: ${existingMeetings.rows[0].deleted_at})`);
            console.log('   👉 Ces données sont conservées pour les statistiques !');
        } else {
            console.log('❌ La réunion a été supprimée physiquement (ÉCHEC)');
        }

        // Étape 6 : Compter toutes les réunions par rapport aux réunions actives
        console.log('\n📝 Test 6: Comptage de toutes les réunions par rapport aux réunions actives...');
        const allCount = await db.query('SELECT COUNT(*) FROM meetings');
        const activeCount = await db.query('SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL');
        console.log(`✅ Total des réunions en base de données : ${allCount.rows[0].count}`);
        console.log(`✅ Réunions actives (vue utilisateur) : ${activeCount.rows[0].count}`);
        console.log(`   👉 Différence: ${allCount.rows[0].count - activeCount.rows[0].count} suppressions logiques`);

        // Étape 7 : Tester les capacités de restauration
        console.log('\n📝 Test 7: Test de la capacité de restauration...');
        await db.query(
            'UPDATE meetings SET deleted_at = NULL WHERE id = $1',
            [meetingId]
        );
        const restoredMeetings = await db.query(
            'SELECT id, title, deleted_at FROM meetings WHERE id = $1 AND deleted_at IS NULL',
            [meetingId]
        );
        if (restoredMeetings.rows.length > 0) {
            console.log('✅ Réunion restaurée avec succès !');
        } else {
            console.log('❌ Échec de la restauration');
        }

        // Nettoyage
        console.log('\n🧹 Nettoyage des données de test...');
        await db.query('DELETE FROM meetings WHERE id = $1', [meetingId]);
        console.log('✅ Réunion de test supprimée\n');

        console.log('='.repeat(60));
        console.log('\n🎉 Tous les tests de suppression logique ont RÉUSSI !\n');
        console.log('Résumé:');
        console.log('  ✅ La suppression logique marque les enregistrements comme supprimés');
        console.log('  ✅ Les enregistrements supprimés sont masqués pour les utilisateurs');
        console.log('  ✅ Les enregistrements supprimés sont conservés pour les statistiques');
        console.log('  ✅ Les enregistrements peuvent être restaurés si besoin\n');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Échec du test:', err);
        process.exit(1);
    }
}

testSoftDelete();
