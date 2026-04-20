const db = require('../config/db');

/**
 * Récupère l'arborescence complète (Equipes + Membres) d'une coordination
 */
exports.getHierarchy = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                COALESCE(t.id, 0) as team_id,
                COALESCE(t.name, 'Sans équipe') as team_name,
                COUNT(cm.id) as member_count,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', cm.id,
                            'name', cm.name,
                            'role', cm.role
                        )
                    ) FILTER (WHERE cm.id IS NOT NULL), 
                    '[]'
                ) as members
            FROM coordination_members cm
            LEFT JOIN teams t ON cm.team_id = t.id
            WHERE cm.coordination_id = $1
            GROUP BY t.id, t.name
            ORDER BY t.name NULLS LAST
        `;
        const result = await db.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur getHierarchy:", err);
        res.status(500).json({ error: "Erreur lors de la récupération de la hiérarchie." });
    }
};

/**
 * Renomme une équipe
 */
exports.updateTeam = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: "Le nom de l'équipe est requis." });
        }

        // Vérification anti-doublon insensible à la casse sur la même coordination
        const getCoordQ = 'SELECT coordination_id FROM teams WHERE id = $1';
        const coordRes = await db.query(getCoordQ, [id]);
        if (coordRes.rows.length === 0) {
            return res.status(404).json({ error: "Équipe introuvable." });
        }
        const coordId = coordRes.rows[0].coordination_id;

        const checkQ = 'SELECT id FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND coordination_id = $2 AND id != $3';
        const checkRes = await db.query(checkQ, [name, coordId, id]);

        if (checkRes.rows.length > 0) {
            return res.status(400).json({ error: "Une autre équipe porte déjà ce nom dans cette coordination." });
        }

        const query = 'UPDATE teams SET name = TRIM($1) WHERE id = $2 RETURNING *';
        const result = await db.query(query, [name, id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erreur updateTeam:", err);
        res.status(500).json({ error: "Erreur lors de la mise à jour de l'équipe." });
    }
};

/**
 * Supprime un participant
 */
exports.deleteAttendee = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM attendees WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Participant introuvable." });
        }
        res.json({ success: true, message: "Participant supprimé avec succès." });
    } catch (err) {
        console.error("Erreur deleteAttendee:", err);
        res.status(500).json({ error: "Erreur lors de la suppression du participant." });
    }
};
