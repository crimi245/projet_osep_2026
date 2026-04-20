const db = require('../config/db');
const xlsx = require('xlsx');

/**
 * Contrôleur Business Intelligence (BI) pour OSEP
 * Gère les rapports consolidés et les indicateurs de performance financiers.
 */
const biController = {
    /**
     * Récupère les indicateurs financiers globaux (Consolidés)
     */
    async getGlobalFinanceStats(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let dateClause = '';
            const params = [];

            if (startDate && endDate) {
                dateClause = ` AND m.start_time BETWEEN $1 AND $2`;
                params.push(startDate, endDate + ' 23:59:59');
            }

            const stats = await db.query(`
                SELECT 
                    COUNT(DISTINCT m.id) as total_meetings,
                    COUNT(a.id) as total_participants,
                    SUM(CASE WHEN a.statut_finance = 'Validé' THEN COALESCE(a.montant, 0) ELSE 0 END) as total_valide,
                    SUM(CASE WHEN a.statut_finance = 'En attente' THEN COALESCE(a.montant, 0) ELSE 0 END) as total_en_attente
                FROM meetings m
                LEFT JOIN attendees a ON m.id = a.meeting_id
                WHERE m.deleted_at IS NULL ${dateClause}
            `, params);

            const perCoordination = await db.query(`
                SELECT 
                    c.name as coordination_name,
                    SUM(COALESCE(a.montant, 0)) as montant_total,
                    COUNT(a.id) as nb_participants
                FROM coordinations c
                JOIN meetings m ON c.id = m.coordination_id
                JOIN attendees a ON m.id = a.meeting_id
                WHERE m.deleted_at IS NULL AND a.statut_finance = 'Validé' ${dateClause}
                GROUP BY c.id, c.name
                ORDER BY montant_total DESC
            `, params);

            res.json({
                success: true,
                summary: stats.rows[0],
                byCoordination: perCoordination.rows
            });
        } catch (error) {
            console.error("Erreur BI Global Stats:", error);
            res.status(500).json({ success: false, message: "Erreur lors du calcul des stats BI" });
        }
    },

    /**
     * Export consolidé au format Excel (XLSX)
     */
    async exportConsolidatedFinance(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let query = `
                SELECT 
                    m.title as reunion_titre,
                    m.meeting_type as type,
                    c.name as coordination,
                    a.nom,
                    a.prenom,
                    a.email,
                    a.structure,
                    a.montant,
                    a.statut_finance,
                    a.created_at as date_emargement
                FROM meetings m
                JOIN attendees a ON m.id = a.meeting_id
                LEFT JOIN coordinations c ON m.coordination_id = c.id
                WHERE m.deleted_at IS NULL
            `;
            const params = [];

            if (startDate && endDate) {
                query += ` AND m.start_time BETWEEN $1 AND $2`;
                params.push(startDate, endDate);
            }

            query += ` ORDER BY m.start_time DESC, a.nom ASC`;

            const result = await db.query(query, params);

            // Transformation en Excel
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.json_to_sheet(result.rows);
            xlsx.utils.book_append_sheet(workbook, worksheet, "Finance_Consolidee");

            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Disposition', 'attachment; filename="Export_Finance_OSEP.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

        } catch (error) {
            console.error("Erreur Export BI:", error);
            res.status(500).send("Erreur lors de l'export financier");
        }
    }
};

module.exports = biController;
