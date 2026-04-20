
const db = require('../config/db');

async function verifyFix() {
    try {
        console.log("Vérification de la correction...");

        // Exécuter la même requête que celle corrigée dans server.js
        const res = await db.query("SELECT COUNT(*) FROM users WHERE role = 'user' AND deleted_at IS NULL");

        console.log("Nombre d'utilisateurs trouvés (role='user'):", res.rows[0].count);

        if (parseInt(res.rows[0].count) > 0) {
            console.log("SUCCÈS: La requête retourne maintenant des résultats !");
        } else {
            console.log("ATTENTION: Le résultat est toujours 0. Vérifiez s'il y a bien des utilisateurs avec le rôle 'user'.");
        }
    } catch (err) {
        console.error("Erreur:", err);
    }
}

verifyFix();
