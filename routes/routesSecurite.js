// Routes API pour le SIEM - Gestion de la sécurité
const express = require('express');
const router = express.Router();
const security = require('../utilitaires/serviceSecurite');
const { isAdmin, isAuthenticated } = require('../middlewares/middlewareAuth');
const controleurSiemAvance = require('../controleurs/controleurSiemAvance');

// ==================== SIEM AVANCÉ ==================== //
router.get('/siem/active-meeting-geo', isAuthenticated, isAdmin, controleurSiemAvance.getActiveMeetingGeo);

// Piloter le Bouclier OSEP (EDR)
router.post('/siem/edr/toggle', isAuthenticated, isAdmin, controleurSiemAvance.toggleEDR);
router.get('/siem/edr/status', isAuthenticated, isAdmin, controleurSiemAvance.getEdrStatus);
router.post('/siem/edr/severity', isAuthenticated, isAdmin, controleurSiemAvance.setEdrSeverity);

router.get('/siem/logs/refused', isAuthenticated, isAdmin, controleurSiemAvance.getRefusedLogs);

// ==================== BLACKLIST ==================== //

// GET /api/admin/security/blacklist - Liste des IPs bloquées
router.get('/blacklist', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { active, type } = req.query;

        let query = `
            SELECT 
                b.*,
                u.username as blocked_by_username,
                CASE 
                    WHEN b.blocked_until IS NULL THEN 'PERMANENT'
                    WHEN b.blocked_until > NOW() THEN 'ACTIVE_TEMP'
                    ELSE 'EXPIRED'
                END as status,
                CASE 
                    WHEN b.blocked_until IS NULL THEN NULL
                    ELSE EXTRACT(EPOCH FROM (b.blocked_until - NOW()))::INTEGER
                END as remaining_seconds
            FROM ip_blacklist b
            LEFT JOIN users u ON b.blocked_by = u.id
            WHERE 1=1
        `;

        const params = [];
        let counter = 1;

        if (active === 'true') {
            query += ` AND b.is_active = TRUE AND (b.blocked_until IS NULL OR b.blocked_until > NOW())`;
        }

        if (type === 'temp') {
            query += ` AND b.blocked_until IS NOT NULL`;
        } else if (type === 'perm') {
            query += ` AND b.blocked_until IS NULL`;
        }

        query += ` ORDER BY b.blocked_at DESC LIMIT 100`;

        const result = await req.app.locals.db.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Erreur lors de la récupération de la liste noire:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/security/blacklist - Bloquer une IP manuellement
router.post('/blacklist', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ip_address, reason, duration, threat_level, notes } = req.body;

        if (!ip_address || !reason) {
            return res.status(400).json({ error: 'IP et raison obligatoires' });
        }

        let blockedUntil = null;
        if (duration && duration > 0) {
            blockedUntil = new Date(Date.now() + duration * 60 * 1000);
        }

        await req.app.locals.db.query(`
            INSERT INTO ip_blacklist 
            (ip_address, reason, blocked_until, threat_level, blocked_by, auto_blocked, notes)
            VALUES ($1, $2, $3, $4, $5, FALSE, $6)
            ON CONFLICT (ip_address) 
            DO UPDATE SET 
                blocked_until = $3,
                threat_level = $4,
                is_active = TRUE,
                notes = $6,
                updated_at = NOW()
        `, [ip_address, reason, blockedUntil, threat_level || 'MEDIUM', req.session.user.id, notes || '']);

        // Logger l'action
        await security.logSecurityEvent(ip_address, 'MANUAL_BLOCK', {
            admin_id: req.session.user.id,
            admin_username: req.session.user.username,
            reason,
            duration: duration || 'PERMANENT'
        });

        res.json({ success: true, message: 'IP bloquée avec succès' });

    } catch (err) {
        console.error('Erreur lors du blocage de l\'IP:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/security/blacklist/:ip - Débloquer une IP
router.delete('/blacklist/:ip', async (req, res) => {
    try {
        const ip = decodeURIComponent(req.params.ip);

        await req.app.locals.db.query(`
            UPDATE ip_blacklist 
            SET is_active = FALSE,
                notes = CONCAT(notes, ' | Débloqué manuellement par ', $2::TEXT)
            WHERE ip_address = $1
        `, [ip, req.session.user.username]);

        await security.logSecurityEvent(ip, 'MANUAL_UNBLOCK', {
            admin_id: req.session.user.id,
            admin_username: req.session.user.username
        });

        res.json({ success: true, message: 'IP débloquée avec succès' });

    } catch (err) {
        console.error('Erreur lors du déblocage de l\'IP:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/security/logs/export - Exporter les logs en CSV
router.get('/logs/export', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { level, action, user, ip, from, to, limit } = req.query;
        console.log('CSV Export Params:', { level, action, user, ip, from, to });


        let query = `
            SELECT 
                l.created_at,
                l.level,
                l.action,
                l.ip_address,
                u.username,
                l.meta
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let counter = 1;

        if (level) {
            query += ` AND l.level = $${counter++}`;
            params.push(level);
        }

        if (action) {
            query += ` AND l.action ILIKE $${counter++}`;
            params.push(`%${action}%`);
        }

        if (user) {
            query += ` AND u.username ILIKE $${counter++}`;
            params.push(`%${user}%`);
        }

        if (ip) {
            query += ` AND l.ip_address ILIKE $${counter++}`;
            params.push(`%${ip}%`);
        }

        if (from) {
            query += ` AND l.created_at >= $${counter++}`;
            params.push(from);
        }

        if (to) {
            query += ` AND l.created_at <= $${counter++}`;
            params.push(to + ' 23:59:59'); // Force end of day
        }

        query += ` ORDER BY l.created_at DESC LIMIT $${counter}`;
        params.push(parseInt(limit || 10000)); // Default limit for export

        const result = await req.app.locals.db.query(query, params);

        // Convert to CSV with Semicolon separator (better for Excel FR) and BOM
        const separator = ';';
        const headers = ['Date', 'Niveau', 'Action', 'Utilisateur', 'IP', 'Détails'];
        const csvRows = [headers.join(separator)];

        result.rows.forEach(row => {
            const date = new Date(row.created_at).toLocaleString('fr-FR');

            // Clean and format details
            let details = '';
            if (row.meta) {
                try {
                    details = JSON.stringify(row.meta).replace(/"/g, '""'); // Escape double quotes
                } catch (e) {
                    details = 'Error parsing JSON';
                }
            }

            const sanitize = (str) => {
                if (str === null || str === undefined) return '';
                return `"${String(str).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
            };

            const values = [
                sanitize(date),
                sanitize(row.level),
                sanitize(row.action),
                sanitize(row.username || 'Système'),
                sanitize(row.ip_address),
                `"${details}"` // Already escaped internally, just wrapping
            ];
            csvRows.push(values.join(separator));
        });

        const csvString = '\uFEFF' + csvRows.join('\r\n'); // Add BOM for UTF-8

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="siem_logs_${Date.now()}.csv"`);
        res.send(csvString);

    } catch (err) {
        console.error('Erreur export CSV:', err);
        res.status(500).send('Erreur lors de l\'export');
    }
});

// ==================== SYSTEM LOGS & STATS ==================== //

// GET /api/admin/security/logs/stats - Statistiques globales pour le Dashboard
router.get('/logs/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = req.app.locals.db;

        // 1. Total événements (24h)
        const totalLogsRes = await db.query(`
            SELECT COUNT(*) FROM system_logs WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        const totalLogs = parseInt(totalLogsRes.rows[0].count);

        // 2. Alertes critiques (24h)
        const alertsRes = await db.query(`
            SELECT COUNT(*) FROM security_events 
            WHERE created_at > NOW() - INTERVAL '24 hours' AND threat_score >= 70
        `);
        const alertsHigh = parseInt(alertsRes.rows[0].count);

        // 3. Menaces bloquées (Actives)
        const blockedRes = await db.query(`
            SELECT COUNT(*) FROM ip_blacklist 
            WHERE is_active = TRUE AND (blocked_until IS NULL OR blocked_until > NOW())
        `);
        const threatsBlocked = parseInt(blockedRes.rows[0].count);

        // 4. Calcul du score d'efficacité (Simplifié)
        // Plus il y a de logs par rapport aux alertes, plus le système est "silencieux" mais vigilant
        let efficiencyScore = 100;
        if (totalLogs > 0) {
            efficiencyScore = 100 - (alertsHigh / totalLogs * 100);
        }
        efficiencyScore = Math.max(0, Math.min(100, efficiencyScore)).toFixed(1);

        // 5. Tendances (Simulées pour l'UI car nécessitent plus d'historique)
        res.json({
            totalEvents: totalLogs,
            eventsTrend: '+2%',
            alertsHigh: alertsHigh,
            alertsTrend: alertsHigh > 5 ? '+12%' : '-5%',
            threatsBlocked: threatsBlocked,
            threatsTrend: '+' + (threatsBlocked % 10),
            efficiencyScore: parseFloat(efficiencyScore),
            avgResponseTime: '240ms'
        });

    } catch (err) {
        console.error('Erreur stats SIEM:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/security/logs - Liste des journaux système paginée
router.get('/logs', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { level, action, user, ip, limit = 50, offset = 0 } = req.query;
        const db = req.app.locals.db;

        let query = `
            SELECT 
                l.id,
                l.created_at,
                l.level,
                l.action,
                l.ip_address,
                u.username,
                l.meta
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let counter = 1;

        if (level) {
            query += ` AND l.level = $${counter++}`;
            params.push(level);
        }

        if (action) {
            query += ` AND l.action ILIKE $${counter++}`;
            params.push(`%${action}%`);
        }

        if (user) {
            query += ` AND u.username ILIKE $${counter++}`;
            params.push(`%${user}%`);
        }

        if (ip) {
            query += ` AND l.ip_address ILIKE $${counter++}`;
            params.push(`%${ip}%`);
        }

        query += ` ORDER BY l.created_at DESC LIMIT $${counter++} OFFSET $${counter++}`;
        params.push(parseInt(limit));
        params.push(parseInt(offset));

        const result = await db.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Erreur logs SIEM:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/security/logs/:id/details - Détails complets d'un log
router.get('/logs/:id/details', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.app.locals.db;

        const result = await db.query(`
            SELECT l.*, u.username as user_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Journal introuvable' });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error('Erreur détails log:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== SECURITY EVENTS ==================== //

// GET /api/admin/security/events - Événements de sécurité
router.get('/events', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { type, ip, limit } = req.query;

        let query = `
            SELECT e.*, u.username 
            FROM security_events e
            LEFT JOIN users u ON e.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let counter = 1;

        if (type) {
            query += ` AND e.event_type = $${counter++}`;
            params.push(type);
        }

        if (ip) {
            query += ` AND e.ip_address = $${counter++}`;
            params.push(ip);
        }

        query += ` ORDER BY e.created_at DESC LIMIT $${counter}`;
        params.push(parseInt(limit || 100));

        const result = await req.app.locals.db.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Erreur lors de la récupération des événements de sécurité:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== THREATS ==================== //

// GET /api/admin/security/threats/stats - Statistiques des menaces
router.get('/threats/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const stats = await req.app.locals.db.query(`
            SELECT
                COUNT(*) FILTER (WHERE threat_level = 'CRITICAL') as critical,
                COUNT(*) FILTER (WHERE threat_level = 'HIGH') as high,
                COUNT(*) FILTER (WHERE threat_level = 'MEDIUM') as medium,
                COUNT(*) FILTER (WHERE threat_level = 'LOW') as low
            FROM ip_blacklist
            WHERE is_active = TRUE
        `);

        const events = await req.app.locals.db.query(`
            SELECT
                event_type,
                COUNT(*) as count
            FROM security_events
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY event_type
        `);

        const blocked = await req.app.locals.db.query(`
            SELECT COUNT(*) as count
            FROM ip_blacklist
            WHERE is_active = TRUE
              AND (blocked_until IS NULL OR blocked_until > NOW())
        `);

        const failed = await req.app.locals.db.query(`
            SELECT COUNT(*) as count
            FROM system_logs
            WHERE action IN ('ECHEC_CONNEXION', 'ECHEC_AUTHENTIFICATION')
              AND created_at > NOW() - INTERVAL '24 hours'
        `);

        res.json({
            threatLevels: stats.rows[0],
            eventTypes: events.rows,
            activeBlocks: parseInt(blocked.rows[0].count),
            failedAttempts24h: parseInt(failed.rows[0].count)
        });

    } catch (err) {
        console.error('Erreur lors de la récupération des statistiques de menaces:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/security/threats/:id - Détails d'une menace spécifique
const controleurSecurite = require('../controleurs/controleurSecurite');
router.get('/threats/:id', controleurSecurite.getThreatDetails);

// GET /api/admin/security/threats - Menaces récentes détectées
router.get('/threats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await req.app.locals.db.query(`
            SELECT 
                e.*,
                b.threat_level,
                b.attempts_count
            FROM security_events e
            LEFT JOIN ip_blacklist b ON e.ip_address = b.ip_address
            WHERE e.event_type IN ('SUSPICIOUS_ACTIVITY', 'TEMP_BLOCK', 'PERM_BLOCK')
              AND e.threat_score >= 30
            ORDER BY e.created_at DESC
            LIMIT 100
        `);

        res.json(result.rows);

    } catch (err) {
        console.error('Erreur lors de la récupération des menaces:', err);
        res.status(500).json({ error: err.message });
    }
});



// ==================== QUARANTINE ==================== //

// GET /api/admin/security/quarantine - Payloads en quarantaine
router.get('/quarantine', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reviewed } = req.query;

        let query = `
            SELECT q.*, u.username as reviewed_by_username
            FROM quarantine_payloads q
            LEFT JOIN users u ON q.reviewed_by = u.id
            WHERE 1=1
        `;

        if (reviewed === 'false') {
            query += ` AND q.reviewed = FALSE`;
        }

        query += ` ORDER BY q.threat_score DESC, q.quarantined_at DESC LIMIT 100`;

        const result = await req.app.locals.db.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error('Erreur lors de la récupération de la quarantaine:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/security/quarantine/:id/action - Action sur payload
router.post('/quarantine/:id/action', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body; // BLOCKED, WHITELISTED, DELETED

        if (!['BLOCKED', 'WHITELISTED', 'DELETED'].includes(action)) {
            return res.status(400).json({ error: 'Action invalide' });
        }

        await req.app.locals.db.query(`
            UPDATE quarantine_payloads
            SET reviewed = TRUE,
                reviewed_by = $1,
                reviewed_at = NOW(),
                action_taken = $2,
                notes = $3
            WHERE id = $4
        `, [req.session.user.id, action, notes || '', id]);

        res.json({ success: true, message: 'Action appliquée' });

    } catch (err) {
        console.error('Erreur lors de la mise à jour de la quarantaine:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== CONFIGURATION ==================== //

// GET /api/admin/security/config - Récupérer configuration
router.get('/config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await req.app.locals.db.query(
            'SELECT * FROM security_config ORDER BY config_key'
        );

        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });

        res.json(config);

    } catch (err) {
        console.error('Erreur lors de la récupération de la configuration:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/admin/security/config - Mettre à jour configuration
router.put('/config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const updates = req.body; // { WARN_THRESHOLD: "30", ... }

        for (const [key, value] of Object.entries(updates)) {
            await req.app.locals.db.query(`
                UPDATE security_config
                SET config_value = $1,
                    updated_by = $2,
                    updated_at = NOW()
                WHERE config_key = $3
            `, [value, req.session.user.id, key]);
        }

        // Invalider le cache
        await security.loadSecurityConfig();

        res.json({ success: true, message: 'Configuration mise à jour' });

    } catch (err) {
        console.error('Erreur lors de la mise à jour de la configuration:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== CAPTCHA ==================== //

// POST /api/security/captcha/verify - Vérifier CAPTCHA (PUBLIC - pas d'auth requise)
router.post('/captcha/verify', async (req, res) => {
    try {
        const { captchaToken } = req.body;
        const ip = req.ip || req.connection.remoteAddress;

        if (!captchaToken) {
            return res.status(400).json({ error: 'Token CAPTCHA manquant' });
        }

        // Vérifier si IP est en soft block
        const blockStatus = await security.checkBlacklist(ip);
        if (!blockStatus.isBlocked || blockStatus.type !== 'TEMPORARY') {
            return res.status(400).json({ error: 'IP non bloquée temporairement' });
        }

        // Vérifier le CAPTCHA avec hCaptcha API
        const verifyUrl = 'https://hcaptcha.com/siteverify';
        const secret = process.env.HCAPTCHA_SECRET_KEY;

        if (!secret) {
            return res.status(500).json({ error: 'CAPTCHA non configuré' });
        }

        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', captchaToken);

        const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            body: params
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.success) {
            // CAPTCHA valide - Débloquer immédiatement
            await req.app.locals.db.query(`
                UPDATE ip_blacklist 
                SET is_active = FALSE,
                    notes = CONCAT(COALESCE(notes, ''), ' | Débloqué via CAPTCHA')
                WHERE ip_address = $1
            `, [ip]);

            await security.logSecurityEvent(ip, 'CAPTCHA_UNBLOCK', {
                method: 'captcha_solved',
                score: blockStatus.threatScore
            });

            return res.json({
                success: true,
                message: 'IP débloquée avec succès'
            });
        } else {
            return res.status(400).json({
                error: 'CAPTCHA invalide',
                message: 'Veuillez réessayer'
            });
        }

    } catch (err) {
        console.error('Erreur lors de la vérification du CAPTCHA:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
