const db = require('../config/db');
const os = require('os');

/**
 * Journaliseur Système Amélioré - Style EDR
 * Journalise les événements dans la table 'system_logs' avec des métadonnées enrichies.
 * 
 * Niveaux : INFO, WARN, ERROR, CRITICAL
 * 
 * Capture : En-têtes HTTP, Données de session, Contexte de requête, Info système
 */
const logger = {
    /**
     * Extraire les métadonnées enrichies de la requête
     */
    extractRequestMetadata(req) {
        if (!req) return {};

        try {
            const headers = {
                userAgent: req.headers?.['user-agent'] || null,
                accept: req.headers?.['accept'] || null,
                referer: req.headers?.['referer'] || req.headers?.['referrer'] || null,
                host: req.headers?.['host'] || null,
            };

            const requestContext = {
                method: req.method || null,
                path: req.path || null,
                query: req.query || {},
                params: req.params || {},
                ip: req.ip || req.connection?.remoteAddress || null
            };

            const sessionInfo = req.session?.user ? {
                userId: req.session.user.id,
                username: req.session.user.username,
                role: req.session.user.role
            } : null;

            return {
                headers,
                request: requestContext,
                session: sessionInfo,
                timestamp: new Date().toISOString()
            };
        } catch (e) {
            console.error("L'extraction des métadonnées du journaliseur a échoué :", e);
            return { error: "L'extraction des métadonnées a échoué" };
        }
    },

    async log(level, action, userId = null, meta = {}, req = null) {
        try {
            // Extraire l'adresse IP
            const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;

            // Garantir que l'ID utilisateur est un entier valide ou null
            let validUserId = null;
            if (userId !== null && userId !== undefined) {
                // Si l'ID utilisateur est un objet, essayer d'extraire la propriété id
                if (typeof userId === 'object') {
                    validUserId = userId.id || null;
                } else {
                    // Convertir en entier s'il s'agit d'une chaîne ou d'un nombre
                    const parsed = parseInt(userId);
                    validUserId = isNaN(parsed) ? null : parsed;
                }
            }

            // Enrichir les métadonnées avec le contexte de la requête
            const enrichedMeta = {
                ...meta,
                _enriched: req ? this.extractRequestMetadata(req) : null,
            };

            // Nettoyer les métadonnées pour garantir un JSON valide
            const metaJson = JSON.stringify(enrichedMeta);

            await db.query(
                `INSERT INTO system_logs (level, action, user_id, meta, ip_address) VALUES ($1, $2, $3, $4, $5)`,
                [level, action, validUserId, metaJson, ip]
            );
        } catch (err) {
            // Basculer sur la console si la journalisation en base de données échoue pour éviter un plantage
            console.error('ÉCHEC DU LOGGER:', err.message);
        }
    },

    info(action, userId, meta, req) {
        return this.log('INFO', action, userId, meta, req);
    },

    warn(action, userId, meta, req) {
        return this.log('WARN', action, userId, meta, req);
    },

    error(action, userId, meta, req) {
        return this.log('ERROR', action, userId, meta, req);
    },

    // Générateur de middleware pour la journalisation générique des routes
    middleware(actionName) {
        return (req, res, next) => {
            const userId = req.session?.user?.id || null;
            this.info(actionName, userId, { method: req.method, url: req.originalUrl }, req);
            next();
        };
    }
};

module.exports = logger;
