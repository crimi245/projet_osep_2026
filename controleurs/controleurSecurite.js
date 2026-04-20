const db = require('../config/db');

/**
 * Obtenir des informations détaillées sur une menace/un événement de sécurité spécifique
 * GET /api/admin/security/threats/:id
 */
exports.getThreatDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // Validation simple de l'ID (entier)
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ error: 'ID invalide' });
        }

        // Requête SQL sécurisée avec jointures
        // On récupère l'événement, l'utilisateur associé (si auth) et le statut blacklist actuel
        const query = `
            SELECT 
                e.*,
                u.username,
                u.full_name,
                b.reason as blacklist_reason,
                b.threat_level as current_threat_level,
                b.is_active as is_ip_blocked
            FROM security_events e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN ip_blacklist b ON e.ip_address = b.ip_address
            WHERE e.id = $1
        `;

        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menace introuvable' });
        }

        const threat = result.rows[0];

        // Analyse des détails JSON si c'est une chaîne
        if (typeof threat.details === 'string') {
            try {
                threat.details = JSON.parse(threat.details);
            } catch (e) {
                // Conserver en tant que chaîne si l'analyse échoue
            }
        }

        res.json(threat);

    } catch (err) {
        console.error('Erreur lors de la récupération des détails de la menace:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
