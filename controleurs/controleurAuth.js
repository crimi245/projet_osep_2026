
const bcrypt = require('bcrypt');
const db = require('../config/db');
const logger = require('../utilitaires/journaliseur');
const { siemEvents } = require('./controleurSiemAvance');

exports.login = async (req, res) => {
    const { username, password, theme } = req.body;
    console.log('[DEBOGAGE] Tentative de connexion pour :', username);

    try {
        const result = await db.query(`
            SELECT u.*, c.name as coordination_name, c.sigle_coordination 
            FROM users u 
            LEFT JOIN coordinations c ON u.coordination_id = c.id 
            WHERE u.username = $1 AND u.deleted_at IS NULL
        `, [username]);

        console.log('[DEBOGAGE] Utilisateur trouvé en base de données :', result.rows.length > 0 ? 'OUI' : 'NON');

        if (result.rows.length === 0) {
            await logger.warn('ECHEC_CONNEXION_UTILISATEUR_INTROUVABLE', null, {
                attempted_username: username,
                reason: 'Utilisateur non trouvé'
            }, req);
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        const user = result.rows[0];

        // Vérifier si le compte est actif
        if (user.is_active === false) {
            await logger.warn('ECHEC_CONNEXION_COMPTE_DESACTIVE', user.id, {
                username: user.username,
                reason: 'Compte désactivé'
            }, req);
            return res.status(403).json({ error: 'Votre compte est désactivé. Veuillez contacter l\'administrateur.' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        console.log('[DEBOGAGE] Correspondance du mot de passe :', match);

        if (!match) {
            await logger.warn('ECHEC_CONNEXION_MOT_DE_PASSE_INCORRECT', user.id, {
                username: user.username,
                attempted_password_length: password ? password.length : 0,
                reason: 'Mot de passe incorrect'
            }, req);

            siemEvents.emit('ACTION_IA', {
                type: 'analyse_comportement',
                message: `L'Agent IA détecte un échec d'authentification pour ${username}.`,
                riskScore: 65,
                target: username
            });

            return res.status(401).json({ error: 'Mot de passe incorrect' });
        }

        // Mettre à jour le thème si fourni
        let currentTheme = user.theme_color;
        if (theme) {
            await db.query('UPDATE users SET theme_color = $1 WHERE id = $2', [theme, user.id]);
            currentTheme = theme;
        }

        // --- JOURNALISATION DE L'APPAREIL ---
        const userAgent = req.headers['user-agent'] || '';
        const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
        const deviceType = isMobile ? 'mobile' : 'desktop';
        const browser_fingerprint = req.body.browser_fingerprint || null;

        // --- SIEM AVANCÉ : Sauvegarde de l'Empreinte et Alerte Géorepérage ---
        let latitude = null, longitude = null;
        if (browser_fingerprint) {
            try {
                // Vraie Géolocalisation via IP
                let clientIp = req.ip || req.connection.remoteAddress;

                // Si environnement de test local, on simule Abidjan (Côte d'Ivoire)
                if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('::ffff:127.0.0.1')) {
                    latitude = 5.359951 + (Math.random() - 0.5) * 0.05; // Léger flottement autour d'Abidjan
                    longitude = -4.008256 + (Math.random() - 0.5) * 0.05;

                    siemEvents.emit('ACTION_IA', {
                        type: 'analyse_comportement',
                        message: `Simulation locale: Position virtuellement fixée à Abidjan (CI)`,
                        riskScore: 20,
                        target: username
                    });
                } else {
                    // Appel à l'API de localisation (fetch natif Node.js)
                    const geoResponse = await fetch(`http://ip-api.com/json/${clientIp}`);
                    const geoData = await geoResponse.json();

                    if (geoData.status === 'success') {
                        latitude = geoData.lat;
                        longitude = geoData.lon;
                    } else {
                        throw new Error("Echec localisation IP-API");
                    }
                }

                await db.query(`
                    UPDATE users 
                    SET browser_fingerprint = $1, latitude = $2, longitude = $3 
                    WHERE id = $4
                `, [browser_fingerprint, latitude, longitude, user.id]);

                // Déclencher une alerte SSE
                const controleurSiemAvance = require('./controleurSiemAvance');
                controleurSiemAvance.diffuserAlerteGeoreperage({
                    userId: user.id,
                    username: user.username,
                    role: user.role,
                    latitude,
                    longitude,
                    message: "Nouvelle connexion tracée"
                });
            } catch (err) {
                console.error("[SIEM] Échec de la mise à jour de localisation/empreinte:", err);
            }
        }

        try {
            await logger.info('CONNEXION_REUSSIE', user.id, { deviceType }, req);
        } catch (logErr) {
            console.error(`[CONNEXION] Échec du journaliseur :`, logErr);
        }

        siemEvents.emit('ACTION_IA', {
            type: 'analyse_comportement',
            message: `L'Agent IA valide le login de ${username}. Empreinte conforme.`,
            riskScore: 5,
            target: username
        });

        // Journal de connexion historique
        try {
            await db.query(
                'INSERT INTO login_logs (user_id, device_type, user_agent, ip_address, login_time) VALUES ($1, $2, $3, $4, NOW())',
                [user.id, deviceType, userAgent, req.ip]
            );
        } catch (legacyErr) {
            console.error(`[CONNEXION] Échec du journal historique (ignoré) :`, legacyErr);
        }

        // Définir la session
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            fullname: user.full_name,
            theme_color: currentTheme,
            coordination_id: user.coordination_id,
            coordination_name: user.coordination_name,
            sigle_coordination: user.sigle_coordination,
            gender: user.gender
        };

        res.json({ success: true, user: req.session.user });
    } catch (err) {
        await logger.error('ERREUR_CONNEXION', null, { error: err.message, username }, req);
        res.status(500).json({ error: err.message });
    }
};

exports.logout = async (req, res) => {
    if (req.session.user) {
        await logger.info('DECONNEXION', req.session.user.id, {}, req);
    }
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
};
