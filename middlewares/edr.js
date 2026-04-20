const serviceSecurite = require('../utilitaires/serviceSecurite');

/**
 * Middleware de Sécurité EDR Bouclier OSEP
 * Intercepte les requêtes pour valider l'empreinte de l'appareil et la géolocalisation.
 */
const edrMiddleware = {
    /**
     * Vérifie l'intégrité de l'accès avant soumission
     */
    async verifierAcces(req, res, next) {
        const { uuid } = req.params;
        const { fingerprint, email, gps, t } = req.body;
        const tokenDynamique = t || req.query.t;
        const sessionToken = req.headers['x-osep-session'] || (req.session ? req.session.osep_session_token : null);

        // --- BYPASS GLOBAL EDR PAR LE SIEM AVANCÉ ---
        if (global.isEdrActive === false) {
            req.edr = {
                score: 100,
                fingerprint: fingerprint || 'bypass_edr',
                identifieParSession: false,
                bypassed: true
            };
            return next();
        }

        // --- BYPASS QR STATIQUE SI ACTIVÉ ---
        if (global.bypassStaticQR === true && !tokenDynamique) {
            req.edr = {
                score: 100,
                fingerprint: fingerprint || 'static_qr_bypass',
                identifieParSession: false,
                bypassed: true,
                staticBypass: true
            };
            return next();
        }

        // 1. Tenter la validation par Session Zero Trust (Bypass QR si déjà identifié)
        if (sessionToken && sessionToken !== 'null' && sessionToken !== 'undefined') {
            const sessionValide = await serviceSecurite.validerSession(sessionToken);
            if (sessionValide && sessionValide.reunion_id === uuid) {
                // Session OK, on peut continuer sans jeton tournant
                req.edr = {
                    score: 100,
                    fingerprint: sessionValide.empreinte_appareil,
                    appareilId: sessionValide.appareil_id,
                    identifieParSession: true
                };
                return next();
            }
        }

        // 2. Si pas de session, Vérification du jeton dynamique (Optionnel si GPS présent)
        const isTokenValid = serviceSecurite.validerTokenDynamique(uuid, tokenDynamique);

        // Si le jeton est présent mais invalide, on bloque (tentative de fraude sur QR dynamique)
        if (tokenDynamique && !isTokenValid) {
            await serviceSecurite.loggerSIEM({
                reunionId: uuid,
                email: email || 'inconnu',
                fingerprint: fingerprint || 'inconnu',
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                action: 'QR_DYNAMIQUE_ECHEC',
                score: 0,
                metadonnees: { token_fourni: tokenDynamique, reason: 'TOKEN_EXPIRE' },
                decision: 'BLOCK'
            });

            return res.status(403).json({
                error: 'Accès refusé.',
                reason: 'Le QR Code a expiré. Merci de scanner le nouveau code affiché à l\'écran.'
            });
        }

        // Note: Si tokenDynamique est absent (QR Statique/Téléchargé), 
        // on laisse passer cette étape, mais le score IA (GPS) sera déterminant.

        if (!fingerprint || !email) {
            return res.status(400).json({ error: 'Empreinte de sécurité ou email manquant.' });
        }

        try {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // 1. Calcul du score de confiance via l'Agent IA
            const metadonnees = {
                gps: gps || null,
                userAgent: userAgent,
                token: tokenDynamique || null // Ajout du Token pour l'agent IA
            };

            // Récupérer la configuration de la réunion (Type + Refresh interval)
            const db = require('../config/db');
            const meetingRes = await db.query('SELECT id, meeting_type FROM meetings WHERE uuid = $1', [uuid]);
            if (meetingRes.rows.length === 0) {
                return res.status(404).json({ error: 'Réunion introuvable' });
            }
            const internalMeetingId = meetingRes.rows[0].id;
            const meetingType = meetingRes.rows[0].meeting_type;

            const score = await serviceSecurite.calculerScoreConfiance(email, fingerprint, ip, metadonnees, internalMeetingId);

            // 2. Journalisation SIEM de la tentative
            await serviceSecurite.loggerSIEM({
                reunionId: uuid,
                email,
                fingerprint,
                ip,
                action: 'EDR_CHECK',
                score,
                metadonnees,
                decision: score > 30 ? 'PASS' : 'BLOCK'
            });

            // 3. Blocage si score trop bas (Fraude probable)
            let blockThreshold = 30; // NORMAL (CCMS, Partenaire)

            // Pour les réunions internes/coordination, on privilégie la traçabilité sur le blocage
            const isSimpleFlow = ['inter', 'intra'].includes(meetingType);
            if (isSimpleFlow) {
                blockThreshold = 0; // On laisse passer si l'appareil et l'email sont présents (traçabilité privilégiée sur le blocage)
            }

            if (global.edrSeverity === 'STRICT') blockThreshold += 15;
            if (global.edrSeverity === 'FAIBLE') blockThreshold = 5;

            if (score < blockThreshold) {
                return res.status(403).json({
                    error: 'Accès refusé par le Bouclier EDR.',
                    reason: `Anomalie de sécurité détectée (Score confiance insuffisant : ${score}/${blockThreshold}).`
                });
            }

            // 4. Enregistrement de l'appareil (Quota supprimé)
            const verifAppareil = await serviceSecurite.verifierOuEnregistrerAppareil(email, fingerprint, userAgent);
            // On ignore désormais les erreurs de quota pour fluidifier l'accès

            // Tout est en ordre, on passe à la suite
            req.edr = {
                score,
                fingerprint,
                appareilId: verifAppareil.appareil.id
            };

            next();

        } catch (err) {
            console.error('Erreur Middleware EDR :', err);
            res.status(500).json({ error: 'Erreur lors de la vérification de sécurité EDR.' });
        }
    }
};

module.exports = edrMiddleware;
