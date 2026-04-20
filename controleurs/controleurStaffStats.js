const db = require('../config/db');

/**
 * Récupère les statistiques globales pour le tableau de bord Staff (Finance)
 */
exports.getStaffOverview = async (req, res) => {
    try {
        const { month, year, status, type, startDate, endDate } = req.query;
        let baseWhere = "m.deleted_at IS NULL";
        let timeParams = [];
        let whereTime = "";

        // Restriction Staff : Inter/Intra créés par soi-même OU réunions gérées (CCMS + Partenaires à incidence financière)
        const currentUserId = req.session.user.id;
        
        // On ne rajoute l'ID utilisateur que s'il est nécessaire pour éviter l'erreur "n'a pas pu déterminer le type de données du paramètre $1"
        if (type && type !== 'all') {
            if (type === 'managed') {
                baseWhere += ` AND (m.meeting_type = 'ccms' OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE))`;
            } else if (type === 'created') {
                timeParams.push(currentUserId);
                baseWhere += ` AND (m.meeting_type IN ('inter', 'intra') AND m.user_id = $${timeParams.length})`;
            } else {
                baseWhere += ` AND m.meeting_type = $${timeParams.length + 1}`;
                timeParams.push(type);
                // Si c'est inter ou intra, on rajoute la sécurité créateur
                if (['inter', 'intra'].includes(type)) {
                    timeParams.push(currentUserId);
                    baseWhere += ` AND m.user_id = $${timeParams.length}`;
                }
            }
        } else {
            timeParams.push(currentUserId);
            baseWhere += ` AND (
                (m.meeting_type IN ('inter', 'intra') AND m.user_id = $${timeParams.length}) 
                OR m.meeting_type = 'ccms' 
                OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE)
                OR m.meeting_type = 'codir'
            )`;
        }

        if (startDate && endDate) {
            // S'assurer que endDate inclut toute la journée (23:59:59)
            const finalEndDate = endDate.includes(' ') ? endDate : `${endDate} 23:59:59`;
            whereTime += ` AND m.start_time BETWEEN $${timeParams.length + 1} AND $${timeParams.length + 2}`;
            timeParams.push(startDate, finalEndDate);
        } else if (year) {
            whereTime += ` AND EXTRACT(YEAR FROM m.start_time) = $${timeParams.length + 1}`;
            timeParams.push(year);
            if (month && month !== 'all') {
                whereTime += ` AND EXTRACT(MONTH FROM m.start_time) = $${timeParams.length + 1}`;
                timeParams.push(month);
            }
        }

        // 1. Nombre total de réunions (filtré par type et temps et éventuellement statut)
        let meetingQuery = `SELECT COUNT(DISTINCT m.id) FROM meetings m LEFT JOIN attendees a ON m.id = a.meeting_id WHERE ${baseWhere}${whereTime}`;
        let meetingParams = [...timeParams];
        if (status && status !== 'all') {
            meetingQuery += ` AND a.statut_finance = $${meetingParams.length + 1}`;
            meetingParams.push(status);
        }
        const meetingsCountResult = await db.query(meetingQuery, meetingParams);
        const totalMeetings = parseInt(meetingsCountResult.rows[0].count);

        // 2. Statistiques des participants (Uniquement CCMS pour les finances, sauf si un autre type est demandé explicitement mais les finances resteront à 0)
        let statsQuery = `
            SELECT 
                COUNT(a.id) as total_participants,
                COUNT(a.id) FILTER (WHERE a.statut_finance = 'Validé') as valides,
                COUNT(a.id) FILTER (WHERE a.statut_finance = 'En attente') as en_attente,
                COUNT(a.id) FILTER (WHERE a.signature_finale = TRUE) as signatures_finales,
                SUM(a.montant) FILTER (WHERE (m.meeting_type = 'ccms' OR m.financial_impact = TRUE) AND a.statut_finance != 'Rejeté') as budget_total,
                SUM(a.montant) FILTER (WHERE (m.meeting_type = 'ccms' OR m.financial_impact = TRUE) AND a.statut_finance = 'Validé') as montant_verse
            FROM attendees a
            JOIN meetings m ON a.meeting_id = m.id
            WHERE ${baseWhere}${whereTime}
        `;
        let statsParams = [...timeParams];
        if (status && status !== 'all') {
            statsQuery += ` AND a.statut_finance = $${statsParams.length + 1}`;
            statsParams.push(status);
        }
        const attendeeStatsResult = await db.query(statsQuery, statsParams);
        const stats = attendeeStatsResult.rows[0];

        // 3. Réunions récentes
        let recentQuery = `SELECT m.id, m.title, m.start_time, m.meeting_type FROM meetings m WHERE ${baseWhere}${whereTime} ORDER BY m.start_time DESC LIMIT 5`;
        const recentMeetingsResult = await db.query(recentQuery, timeParams);

        // 4. Statistiques mensuelles pour le graphique
        const yearForChart = year || new Date().getFullYear();
        const monthlyResult = await db.query(`
            SELECT
                TO_CHAR(m.start_time, 'Mon') as mois,
                EXTRACT(MONTH FROM m.start_time) as mois_num,
                COUNT(DISTINCT m.id) as count,
                COALESCE(SUM(a.montant) FILTER (WHERE m.meeting_type = 'ccms' AND a.statut_finance != 'Rejeté'), 0) as montant
            FROM meetings m
            LEFT JOIN attendees a ON a.meeting_id = m.id
            WHERE m.deleted_at IS NULL
              AND (
                (m.meeting_type IN ('inter', 'intra') AND m.user_id = $2)
                OR m.meeting_type = 'ccms'
                OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE)
                OR m.meeting_type = 'codir'
              )
              AND EXTRACT(YEAR FROM m.start_time) = $1
            GROUP BY mois, mois_num
            ORDER BY mois_num
        `, [yearForChart, currentUserId]);

        // 5. Totaux mensuels CCMS année précédente (pour la courbe de comparaison)
        const prevResult = await db.query(`
            SELECT
                EXTRACT(MONTH FROM m.start_time) as mois_num,
                COUNT(*) as total
            FROM meetings m
            WHERE m.deleted_at IS NULL
              AND m.meeting_type = 'ccms'
              AND EXTRACT(YEAR FROM m.start_time) = $1
            GROUP BY mois_num
            ORDER BY mois_num
        `, [yearForChart - 1]);

        res.json({
            success: true,
            total_meetings: totalMeetings,
            total_participants: parseInt(stats.total_participants) || 0,
            valides: parseInt(stats.valides) || 0,
            en_attente: parseInt(stats.en_attente) || 0,
            signatures_finales: parseInt(stats.signatures_finales) || 0,
            budget_total: parseFloat(stats.budget_total) || 0,
            montant_verse: parseFloat(stats.montant_verse) || 0,
            taux_completion: stats.total_participants > 0 ? (stats.valides / stats.total_participants * 100).toFixed(2) : 0,
            recent_meetings: recentMeetingsResult.rows,
            monthly_stats: monthlyResult.rows.map(r => ({
                mois_num: parseInt(r.mois_num),
                mois: r.mois,
                count: parseInt(r.count) || 0,
                montant: parseFloat(r.montant) || 0
            })),
            monthly_stats_prev: prevResult.rows.map(r => ({
                mois_num: parseInt(r.mois_num),
                total: parseInt(r.total) || 0
            }))
        });
    } catch (error) {
        console.error("Erreur overview staff stats:", error);
        res.status(500).json({ success: false, error: "Erreur serveur" });
    }
};


/**
 * Récupère les statistiques par réunion pour le tableau de suivi
 */
exports.getStaffPerMeetingStats = async (req, res) => {
    try {
        const { month, year, status, type, startDate, endDate } = req.query;
        let whereClause = "WHERE m.deleted_at IS NULL";
        let params = [];

        // Restriction Staff
        const currentUserId = req.session.user.id;

        // Filtrage par type
        if (type && type !== 'all') {
            if (type === 'managed') {
                whereClause += ` AND (m.meeting_type = 'ccms' OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE))`;
            } else if (type === 'created') {
                params.push(currentUserId);
                whereClause += ` AND (m.meeting_type IN ('inter', 'intra') AND m.user_id = $${params.length})`;
            } else {
                whereClause += ` AND m.meeting_type = $${params.length + 1}`;
                params.push(type);
                if (['inter', 'intra'].includes(type)) {
                    params.push(currentUserId);
                    whereClause += ` AND m.user_id = $${params.length}`;
                }
            }
        } else {
            params.push(currentUserId);
            whereClause += ` AND (
                (m.meeting_type IN ('inter', 'intra') AND m.user_id = $${params.length}) 
                OR m.meeting_type = 'ccms' 
                OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE)
                OR m.meeting_type = 'codir'
            )`;
        }

        if (startDate && endDate) {
            // S'assurer que endDate inclut toute la journée (23:59:59)
            const finalEndDate = endDate.includes(' ') ? endDate : `${endDate} 23:59:59`;
            whereClause += ` AND m.start_time BETWEEN $${params.length + 1} AND $${params.length + 2}`;
            params.push(startDate, finalEndDate);
        } else if (year) {
            whereClause += ` AND EXTRACT(YEAR FROM m.start_time) = $${params.length + 1}`;
            params.push(year);
            if (month && month !== 'all') {
                whereClause += ` AND EXTRACT(MONTH FROM m.start_time) = $${params.length + 1}`;
                params.push(month);
            }
        }
        
        let attendeeFilter = "";
        if (status && status !== 'all') {
            attendeeFilter = ` AND a.statut_finance = $${params.length + 1}`;
            params.push(status);
        }

        const query = `
            SELECT 
                m.id, m.title, m.meeting_type, m.start_time, m.financial_impact,
                COUNT(a.id) as total_participants,
                COUNT(a.id) FILTER (WHERE a.statut_finance = 'Validé') as valides,
                COUNT(a.id) FILTER (WHERE a.statut_finance = 'En attente') as en_attente,
                COALESCE(SUM(a.montant) FILTER (WHERE a.statut_finance = 'Validé'), 0) as montant_valide
            FROM meetings m
            LEFT JOIN attendees a ON m.id = a.meeting_id ${attendeeFilter}
            ${whereClause}
            GROUP BY m.id, m.title, m.meeting_type, m.start_time, m.financial_impact
            ORDER BY m.start_time DESC
        `;
        const result = await db.query(query, params);

        res.json({ success: true, meetings: result.rows });
    } catch (error) {
        console.error("Erreur stats par réunion:", error);
        res.status(500).json({ success: false, error: "Erreur serveur" });
    }
};
exports.getStaffCharts = async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const distributionResult = await db.query(`
            SELECT meeting_type, COUNT(*) as count 
            FROM meetings 
            WHERE deleted_at IS NULL 
              AND (
                (meeting_type IN ('inter', 'intra') AND user_id = $1)
                OR meeting_type = 'ccms'
                OR (meeting_type = 'partenaire_externe' AND financial_impact = TRUE)
                OR meeting_type = 'codir'
              )
            GROUP BY meeting_type
        `, [currentUserId]);
        
        // 2. Tendance des inscriptions (7 derniers jours)
        const trendResult = await db.query(`
            SELECT TO_CHAR(created_at, 'DD Mon') as date, COUNT(*) as count
            FROM attendees
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY TO_CHAR(created_at, 'DD Mon'), created_at
            ORDER BY created_at
        `);

        res.json({
            success: true,
            distribution: {
                labels: distributionResult.rows.map(r => r.meeting_type === 'intra' ? 'Intra-coordination' : 'Inter-coordination'),
                data: distributionResult.rows.map(r => parseInt(r.count))
            },
            trend: {
                labels: trendResult.rows.map(r => r.date),
                data: trendResult.rows.map(r => parseInt(r.count))
            }
        });
    } catch (error) {
        console.error("Erreur charts staff stats:", error);
        res.status(500).json({ success: false, error: "Erreur serveur" });
    }
};

/**
 * Récupère les alertes pour le staff (réunions terminées avec validations en attente)
 */
exports.getStaffAlerts = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const currentUserId = req.session.user.id;
        
        let dateClause = '';
        const params = [currentUserId];

        if (startDate && endDate) {
            dateClause = ` AND m.start_time BETWEEN $2 AND $3`;
            params.push(startDate, endDate + ' 23:59:59');
        }

        const result = await db.query(`
            SELECT 
                m.id, m.title, m.end_time,
                COUNT(a.id) FILTER (WHERE a.statut_finance = 'En attente') as en_attente
            FROM meetings m
            JOIN attendees a ON m.id = a.meeting_id
            WHERE m.deleted_at IS NULL
              AND m.end_time < NOW()
              AND a.statut_finance = 'En attente'
              ${dateClause}
              AND (
                (m.meeting_type IN ('inter', 'intra') AND m.user_id = $1)
                OR m.meeting_type = 'ccms'
                OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE)
                OR m.meeting_type = 'codir'
              )
            GROUP BY m.id, m.title, m.end_time
            HAVING COUNT(a.id) FILTER (WHERE a.statut_finance = 'En attente') > 0
            ORDER BY m.end_time DESC
        `, params);

        res.json({ success: true, alerts: result.rows });
    } catch (error) {
        console.error("Erreur récup alertes staff:", error);
        res.status(500).json({ success: false, error: "Erreur serveur" });
    }
};
