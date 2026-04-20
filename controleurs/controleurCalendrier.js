const db = require('../config/db');

/**
 * Récupère les événements du calendrier pour l'utilisateur connecté.
 * Sécurité : Utilise strictement req.session.user.id.
 */
exports.getUserEvents = async (req, res) => {
    try {
        const userId = req.session.user.id;
        if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

        // 1. Récupérer le nom d'utilisateur de l'utilisateur pour la correspondance participants
        const userRes = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
        const userUsername = userRes.rows[0]?.username;

        // Requête : Organisateur (ID) OU Participant (Email)
        const query = `
            SELECT 
                m.id, m.uuid, m.title, m.start_time, m.end_time, 
                m.location, m.meeting_type, m.priority, m.user_id as creator_id
            FROM meetings m
            LEFT JOIN attendees a ON m.id = a.meeting_id
            WHERE 
                (m.user_id = $1 OR (a.email = $2 AND a.email IS NOT NULL))
                AND m.deleted_at IS NULL
            GROUP BY m.id
            ORDER BY m.start_time ASC
        `;

        const result = await db.query(query, [userId, userUsername]);

        const events = result.rows.map(row => ({
            id: row.uuid,
            title: row.title,
            start: row.start_time,
            end: row.end_time,
            location: row.location,
            type: row.meeting_type || 'intra',
            priority: row.priority || 'medium',
            isOrganizer: row.creator_id === userId
        }));

        res.json(events);

    } catch (error) {
        console.error("Erreur getUserEvents:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

/**
     * Récupère tous les événements du calendrier pour l'administrateur.
     * Sécurité : Réservé aux admins via middleware dans les routes.
     */
exports.getAllAdminEvents = async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id, m.uuid, m.title, m.start_time, m.end_time,
                m.meeting_type, m.priority,
                u.id as organizer_id, u.username, u.full_name as nom_complet, u.theme_color
            FROM meetings m 
            JOIN users u ON m.user_id = u.id
            WHERE m.deleted_at IS NULL
            ORDER BY m.start_time ASC
        `;

        const result = await db.query(query);

        const events = result.rows.map(row => ({
            id: row.uuid,
            title: row.title,
            start: row.start_time,
            end: row.end_time,
            type: row.meeting_type || 'intra',
            priority: row.priority || 'medium',
            organizer: {
                id: row.organizer_id,
                username: row.username,
                name: row.nom_complet || row.username,
                color: row.theme_color || '#38bdf8' // Avatar par défaut ou couleur de l'utilisateur
            }
        }));

        res.json(events);

    } catch (error) {
        console.error("Erreur getAllAdminEvents:", error);
        res.status(500).json({ error: "Erreur serveur de récupération calendrier admin" });
    }
};
