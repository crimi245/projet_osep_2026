// Middleware de sécurité avec système de réponse graduée
// Scoring 0-100 : WARN (30) -> SOFT_BLOCK (60) -> HARD_BLOCK (90)

const db = require('../config/db');

// Seuils par défaut (modifiables via security_config)
let THRESHOLDS = {
    WARN: { score: 30, action: 'LOG_ONLY', description: 'Activité suspecte - Log seulement' },
    SOFT_BLOCK: { score: 60, action: 'TEMP_BLOCK', duration: 2, description: 'Blocage temporaire' },
    HARD_BLOCK: { score: 90, action: 'PERM_BLOCK', duration: null, description: 'Bannissement' }
};

// Cache pour les configurations (refresh toutes les 5 min)
let configCache = null;
let configCacheTime = 0;

// Charger la configuration depuis la DB
async function loadSecurityConfig() {
    const now = Date.now();
    if (configCache && (now - configCacheTime) < 300000) { // 5 min cache
        return configCache;
    }

    try {
        const result = await db.query('SELECT config_key, config_value FROM security_config');
        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });

        // Mettre à jour les seuils avec les clés françaises
        THRESHOLDS.WARN.score = parseInt(config.SEUIL_ALERTE || 30);
        THRESHOLDS.SOFT_BLOCK.score = parseInt(config.SEUIL_BLOCAGE_LÉGER || 60);
        THRESHOLDS.HARD_BLOCK.score = parseInt(config.SEUIL_BLOCAGE_SÉVÈRE || 90);
        THRESHOLDS.SOFT_BLOCK.duration = parseInt(config.DURÉE_BLOCAGE_LÉGER || 2);

        // Agent actif ?
        config.AGENT_ACTIF = (config.AGENT_SÉCURITÉ_ACTIF !== 'false');

        configCache = config;
        configCacheTime = now;
        return config;
    } catch (err) {
        console.error('Erreur lors du chargement de la configuration de sécurité:', err);
        return {};
    }
}

// Vérifier si IP est en liste blanche
function isWhitelisted(ip, config) {
    const whitelist = (config.LISTE_BLANCHE_IPS || '127.0.0.1,::1').split(',').map(i => i.trim());
    return whitelist.includes(ip);
}

// Vérification optimisée de la blacklist (avec expiration automatique)
async function checkBlacklist(ip) {
    try {
        const result = await db.query(`
            SELECT 
                ip_address,
                reason,
                blocked_until,
                threat_level,
                threat_score,
                CASE 
                    WHEN blocked_until IS NULL THEN 'PERMANENT'
                    ELSE 'TEMPORARY'
                END as block_type,
                CASE 
                    WHEN blocked_until IS NULL THEN NULL
                    ELSE EXTRACT(EPOCH FROM (blocked_until - NOW()))::INTEGER
                END as remaining_seconds
            FROM ip_blacklist
            WHERE ip_address = $1
              AND is_active = TRUE
              AND (blocked_until IS NULL OR blocked_until > NOW())
            LIMIT 1
        `, [ip]);

        if (result.rows.length === 0) {
            return { isBlocked: false };
        }

        const block = result.rows[0];
        return {
            isBlocked: true,
            type: block.block_type,
            reason: block.reason,
            remainingSeconds: block.remaining_seconds,
            threatLevel: block.threat_level,
            threatScore: block.threat_score
        };
    } catch (err) {
        console.error('Erreur lors de la vérification de la liste noire:', err);
        return { isBlocked: false };
    }
}

// Fonction de blocage avec durée
async function blockIP(ip, options) {
    const { reason, duration, score, autoBlocked, threatLevel, userId } = options;

    let blockedUntil = null;
    if (duration) {
        blockedUntil = new Date(Date.now() + duration * 60 * 1000);
    }

    try {
        await db.query(`
            INSERT INTO ip_blacklist 
            (ip_address, reason, blocked_until, auto_blocked, threat_level, threat_score, blocked_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (ip_address) 
            DO UPDATE SET 
                blocked_until = $3,
                threat_score = $6,
                attempts_count = ip_blacklist.attempts_count + 1,
                last_attempt = NOW(),
                is_active = TRUE
        `, [ip, reason, blockedUntil, autoBlocked, threatLevel || 'MEDIUM', score, userId || null]);

        console.log(`🚫 IP ${ip} bloquée - Raison: ${reason} - Score: ${score} - Durée: ${duration || 'PERMANENT'} min`);
    } catch (err) {
        console.error('Erreur lors du blocage de l\'IP:', err);
    }
}

// Logger un événement de sécurité
async function logSecurityEvent(ip, eventType, details) {
    try {
        await db.query(`
            INSERT INTO security_events (event_type, ip_address, threat_score, action_taken, details)
            VALUES ($1, $2, $3, $4, $5)
        `, [eventType, ip, details.score || 0, details.action || 'LOGGED', JSON.stringify(details)]);
    } catch (err) {
        console.error('Erreur lors de l\'enregistrement de l\'événement de sécurité:', err);
    }
}

// Mettre en quarantaine un payload suspect
async function quarantinePayload(req, threatScore, patterns) {
    try {
        const payload = JSON.stringify({
            body: req.body,
            query: req.query,
            params: req.params,
            url: req.originalUrl
        });

        await db.query(`
            INSERT INTO quarantine_payloads 
            (ip_address, payload_type, payload_content, threat_score, detected_patterns, action_taken)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            req.ip,
            'HTTP_REQUEST',
            payload.substring(0, 5000), // Limiter à 5000 chars
            threatScore,
            JSON.stringify(patterns || []),
            'PENDING'
        ]);

        console.log(`⚠️ Payload mis en quarantaine - IP: ${req.ip} - Score: ${threatScore}`);
    } catch (err) {
        console.error('Erreur lors de la mise en quarantaine du payload:', err);
    }
}

// Analyser les patterns malveillants
async function analyzePatterns(req) {
    try {
        const payload = JSON.stringify({
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers
        }).toLowerCase();

        let score = 0;
        const matches = [];

        // Charger patterns depuis DB
        const patterns = await db.query(
            'SELECT * FROM threat_patterns WHERE is_active = TRUE'
        );

        for (const pattern of patterns.rows) {
            try {
                const regex = new RegExp(pattern.pattern_regex, 'i');
                if (regex.test(payload)) {
                    matches.push({
                        name: pattern.pattern_name,
                        type: pattern.pattern_type,
                        severity: pattern.severity
                    });

                    score += pattern.score_impact || 10;
                }
            } catch (e) {
                console.error(`Regex invalide dans le pattern ${pattern.id}:`, e);
            }
        }

        return { score: Math.min(score, 30), matches };
    } catch (err) {
        console.error('Erreur lors de l\'analyse des patterns:', err);
        return { score: 0, matches: [] };
    }
}

// Obtenir le taux de requêtes (requests per minute)
async function getRequestRate(ip, seconds) {
    try {
        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM system_logs
            WHERE ip_address = $1
              AND created_at > NOW() - INTERVAL '${seconds} seconds'
        `, [ip]);

        return parseInt(result.rows[0]?.count || 0);
    } catch (err) {
        console.error('Erreur lors de la récupération du taux de requêtes:', err);
        return 0;
    }
}

// Obtenir les tentatives échouées récentes
async function getFailedAttempts(ip, seconds) {
    try {
        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM system_logs
            WHERE ip_address = $1
              AND action IN ('ECHEC_CONNEXION', 'ECHEC_AUTHENTIFICATION')
              AND created_at > NOW() - INTERVAL '${seconds} seconds'
        `, [ip]);

        return parseInt(result.rows[0]?.count || 0);
    } catch (err) {
        console.error('Erreur lors de la récupération des tentatives échouées:', err);
        return 0;
    }
}

// Obtenir l'historique de l'IP
async function getIPHistory(ip) {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE auto_blocked = TRUE) as previous_blocks,
                MAX(threat_score) as max_score
            FROM ip_blacklist
            WHERE ip_address = $1
        `, [ip]);

        return {
            previousBlocks: parseInt(result.rows[0]?.previous_blocks || 0),
            maxScore: parseInt(result.rows[0]?.max_score || 0)
        };
    } catch (err) {
        console.error('Erreur lors de la récupération de l\'historique IP:', err);
        return { previousBlocks: 0, maxScore: 0 };
    }
}

// Calculer le score de menace (0-100)
async function calculateThreatScore(req) {
    let score = 0;
    const ip = req.ip || req.connection.remoteAddress;

    // 1. Analyse des patterns (30 points max)
    const patterns = await analyzePatterns(req);
    score += patterns.score;
    req.detectedPatterns = patterns.matches;

    // 2. Rate limiting (30 points max)
    const requestRate = await getRequestRate(ip, 60); // 1 minute
    if (requestRate > 100) score += 30;
    else if (requestRate > 50) score += 20;
    else if (requestRate > 30) score += 10;

    // 3. Failed login attempts (20 points max)
    const failedAttempts = await getFailedAttempts(ip, 300); // 5 minutes
    if (failedAttempts > 10) score += 20;
    else if (failedAttempts > 5) score += 15;
    else if (failedAttempts > 3) score += 10;

    // 4. Historical behavior (20 points max)
    const history = await getIPHistory(ip);
    if (history.previousBlocks > 2) score += 20;
    else if (history.previousBlocks > 0) score += 10;

    return Math.min(score, 100); // Cap à 100
}

// Middleware principal de détection
async function securityMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;

    try {
        // Charger config
        const config = await loadSecurityConfig();

        // 0. Si l'agent est désactivé, on passe directement
        if (config.AGENT_ACTIF === false) {
            return next();
        }

        // 1. Vérifier liste blanche
        if (isWhitelisted(ip, config)) {
            return next();
        }

        // 2. Vérifier si IP est bloquée
        const blockStatus = await checkBlacklist(ip);
        if (blockStatus.isBlocked) {
            if (blockStatus.type === 'TEMPORARY') {
                return res.status(429).json({
                    error: 'Trop de requêtes',
                    message: 'Veuillez patienter ou résoudre le CAPTCHA',
                    retryAfter: blockStatus.remainingSeconds,
                    captchaRequired: config.CAPTCHA_ACTIVÉ === 'true',
                    blocked: true
                });
            } else {
                return res.status(403).json({
                    error: 'Accès refusé',
                    message: 'Votre IP a été bloquée pour activité malveillante',
                    blocked: true
                });
            }
        }

        // 3. Calculer le score de menace
        const threatScore = await calculateThreatScore(req);

        // 4. Action basée sur le score (Réponse Graduée)
        if (threatScore < THRESHOLDS.WARN.score) {
            // Trafic normal - Aucune action
            return next();
        }

        if (threatScore < THRESHOLDS.SOFT_BLOCK.score) {
            // Niveau WARN : Log seulement
            await logSecurityEvent(ip, 'SUSPICIOUS_ACTIVITY', {
                score: threatScore,
                action: 'LOGGED',
                patterns: req.detectedPatterns,
                url: req.originalUrl
            });
            return next(); // Autoriser quand même
        }

        if (threatScore < THRESHOLDS.HARD_BLOCK.score) {
            // Niveau SOFT_BLOCK : Blocage temporaire
            await blockIP(ip, {
                reason: 'AUTOMATED_TEMP_BLOCK',
                duration: THRESHOLDS.SOFT_BLOCK.duration,
                score: threatScore,
                autoBlocked: true,
                threatLevel: 'MEDIUM'
            });

            await logSecurityEvent(ip, 'TEMP_BLOCK', {
                score: threatScore,
                action: 'BLOCKED_TEMP',
                patterns: req.detectedPatterns,
                duration: THRESHOLDS.SOFT_BLOCK.duration
            });

            return res.status(429).json({
                error: 'Vérification de sécurité déclenchée',
                message: `Trop de tentatives suspectes. Réessayez dans ${THRESHOLDS.SOFT_BLOCK.duration} minutes.`,
                retryAfter: THRESHOLDS.SOFT_BLOCK.duration * 60,
                captchaRequired: config.CAPTCHA_ACTIVÉ === 'true',
                blocked: true
            });
        }

        // Niveau HARD_BLOCK : Bannissement permanent
        await blockIP(ip, {
            reason: 'CRITICAL_THREAT',
            duration: null,
            score: threatScore,
            autoBlocked: true,
            threatLevel: 'CRITICAL'
        });

        await logSecurityEvent(ip, 'PERM_BLOCK', {
            score: threatScore,
            action: 'BLOCKED_PERM',
            patterns: req.detectedPatterns
        });

        await quarantinePayload(req, threatScore, req.detectedPatterns);

        return res.status(403).json({
            error: 'Menace critique bloquée',
            message: 'Activité malveillante détectée',
            blocked: true
        });

    } catch (err) {
        console.error('Erreur du middleware de sécurité:', err);
        // En cas d'erreur, on laisse passer pour ne pas casser l'app
        return next();
    }
}

module.exports = {
    securityMiddleware,
    checkBlacklist,
    blockIP,
    logSecurityEvent,
    loadSecurityConfig
};
