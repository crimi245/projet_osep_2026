const db = require('../config/db');
const crypto = require('crypto');

// Secret interne pour le TOTP (À mettre dans .env idéalement)
const OSEP_SECURITY_SECRET = process.env.OSEP_SECURITY_SECRET || 'bouclier_osep_secret_ultra_confidentiel';

/**
 * Service de Sécurité "Bouclier OSEP"
 * Gère l'architecture Zero Trust, l'Agent IA Anti-Fraude et le SIEM.
 */
const serviceSecurite = {

    /**
     * Génère un jeton TOTP dynamique (rotation via interval_sec) pour une réunion
     */
    genererTokenDynamique(uuid, interval_sec = 30) {
        const secret = process.env.TOTP_SECRET || 'osep_qr_secret_2024';
        const counter = Math.floor(Date.now() / (interval_sec * 1000));
        return crypto.createHmac('sha256', secret)
            .update(`${uuid}:${counter}`)
            .digest('hex')
            .substring(0, 10);
    },

    /**
     * Génère un code de défi de 3 chiffres (rotation via interval_sec)
     */
    genererChallengeCode(uuid, interval_sec = 60) { // On utilisera la valeur custom, mais le param optionnel existe
        const secret = process.env.TOTP_SECRET || 'osep_qr_secret_2024';
        const counter = Math.floor(Date.now() / (interval_sec * 1000));
        const hash = crypto.createHmac('sha256', secret)
            .update(`${uuid}:challenge:${counter}`)
            .digest('hex');
        return (parseInt(hash.substring(0, 8), 16) % 900 + 100).toString();
    },

    /**
     * Valide le code de défi
     */
    validerChallengeCode(uuid, code, interval_sec = 60) {
        if (!code) return false;

        // Simuler le passage du temps (Tolérance sur l'intervalle précédent)
        const secret = process.env.TOTP_SECRET || 'osep_qr_secret_2024';
        const currentCounter = Math.floor(Date.now() / (interval_sec * 1000));

        let hash = crypto.createHmac('sha256', secret).update(`${uuid}:challenge:${currentCounter}`).digest('hex');
        const current = (parseInt(hash.substring(0, 8), 16) % 900 + 100).toString();
        if (code === current) return true;

        // Tolérance : période précédente
        const prevCounter = currentCounter - 1;
        hash = crypto.createHmac('sha256', secret).update(`${uuid}:challenge:${prevCounter}`).digest('hex');
        const previous = (parseInt(hash.substring(0, 8), 16) % 900 + 100).toString();

        return code === previous;
    },

    /**
     * Valide un jeton dynamique (Accepte le jeton actuel et le précédent)
     */
    validerTokenDynamique(uuid, token, interval_sec = 30) {
        if (!token) return false;
        const secret = process.env.TOTP_SECRET || 'osep_qr_secret_2024';
        const counter = Math.floor(Date.now() / (interval_sec * 1000));

        const current = crypto.createHmac('sha256', secret).update(`${uuid}:${counter}`).digest('hex').substring(0, 10);
        if (token === current) return true;

        const previous = crypto.createHmac('sha256', secret).update(`${uuid}:${counter - 1}`).digest('hex').substring(0, 10);
        if (token === previous) return true;

        return false;
    },

    /**
     * Enregistre ou met à jour un participant unique
     */
    async enregistrerParticipant(email, nom, departement) {
        const sql = `
            INSERT INTO participants_uniques (adresse_email, nom_complet, departement)
            VALUES ($1, $2, $3)
            ON CONFLICT (adresse_email) 
            DO UPDATE SET nom_complet = EXCLUDED.nom_complet, departement = EXCLUDED.departement
            RETURNING *;
        `;
        const result = await db.query(sql, [email, nom, departement]);
        return result.rows[0];
    },

    /**
     * Récupère un participant unique par son email
     */
    async obtenirParticipantParEmail(email) {
        const res = await db.query('SELECT * FROM participants_uniques WHERE adresse_email = $1', [email]);
        return res.rows[0] || null;
    },

    /**
     * OBSOLÈTE : Compte le nombre d'emails liés à une empreinte d'appareil
     * (Le quota a été supprimé à la demande du client)
     */
    async compterComptesParEmpreinte(fingerprint) {
        return 0;
    },

    /**
     * Vérifie ou enregistre un appareil (avec gestion du quota de 4 via Trigger DB)
     */
    async verifierOuEnregistrerAppareil(email, fingerprint, userAgent) {
        try {
            // 1. Vérifier si l'appareil est déjà connu pour cet email précisément
            const existRes = await db.query(
                'SELECT * FROM appareils_connus WHERE adresse_email = $1 AND empreinte_appareil = $2',
                [email, fingerprint]
            );

            if (existRes.rows.length > 0) {
                await db.query(
                    'UPDATE appareils_connus SET derniere_utilisation = CURRENT_TIMESTAMP WHERE id = $1',
                    [existRes.rows[0].id]
                );
                return { succes: true, appareil: existRes.rows[0], nouveau: false };
            }

            /* Quota de 4 supprimé - Libre accès pour tous les appareils */

            // 3. Tenter l'insertion
            const insertRes = await db.query(
                'INSERT INTO appareils_connus (adresse_email, empreinte_appareil, user_agent) VALUES ($1, $2, $3) RETURNING *',
                [email, fingerprint, userAgent]
            );

            return { succes: true, appareil: insertRes.rows[0], nouveau: true };

        } catch (err) {
            if (err.message.includes('Quota de 4 appareils atteint')) {
                return { succes: false, erreur: 'QUOTA_DEPASSE', message: err.message };
            }
            throw err;
        }
    },

    /**
     * Purge tous les comptes liés à une empreinte pour permettre un nouveau départ (Décharge)
     */
    async purgerComptesParEmpreinte(fingerprint) {
        // 1. Récupérer la liste des emails pour le SIEM avant suppression
        const emailsRes = await db.query('SELECT adresse_email FROM appareils_connus WHERE empreinte_appareil = $1', [fingerprint]);
        const emailsSupprimes = emailsRes.rows.map(r => r.adresse_email);

        // 2. Supprimer les liaisons d'appareils (Mais garde les participants_uniques pour l'historique SIEM)
        await db.query('DELETE FROM appareils_connus WHERE empreinte_appareil = $1', [fingerprint]);

        return emailsSupprimes;
    },

    /**
     * Crée une session Zero Trust éphémère (2h par défaut)
     */
    async creerSession(email, appareilId, reunionId = null) {
        const jeton = crypto.randomUUID();
        const dateExpiration = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 heures

        const sql = `
            INSERT INTO sessions_actives (jeton_session, adresse_email, appareil_id, reunion_id, date_expiration)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING jeton_session;
        `;
        const result = await db.query(sql, [jeton, email, appareilId, reunionId, dateExpiration]);
        return result.rows[0].jeton_session;
    },


    /**
     * Valide un jeton de session
     */
    async validerSession(jeton) {
        const sql = `
            SELECT s.*, p.nom_complet, a.empreinte_appareil
            FROM sessions_actives s
            JOIN participants_uniques p ON s.adresse_email = p.adresse_email
            JOIN appareils_connus a ON s.appareil_id = a.id
            WHERE s.jeton_session = $1 AND s.date_expiration > CURRENT_TIMESTAMP
            LIMIT 1;
        `;
        const result = await db.query(sql, [jeton]);
        return result.rows[0] || null;
    },

    /**
     * Calculer le score de confiance (Moteur de scoring IA "Bouclier OSEP")
     * Basé sur une trilogie de confiance : Jeton (30), GPS (40), Empreinte (30)
     */
    async calculerScoreConfiance(email, fingerprint, ip, metadonnees = {}, meetingId = null) {
        let score = 0;
        const details = {
            token: false,
            gps: 'absent',
            appareil: 'inconnu',
            dist: null
        };

        // 1. Vérification de l'historique de l'IA (Si déjà bloqué par admin)
        const participant = await db.query('SELECT est_suspendu FROM participants_uniques WHERE adresse_email = $1', [email]);
        if (participant.rows[0]?.est_suspendu) return 0;

        // 2. Facteur 1 : Jeton Dynamique (40 points)
        let meetingConfig = { token_refresh_interval: 30 }; // default
        if (meetingId) {
            const mConfigRes = await db.query('SELECT token_refresh_interval FROM meetings WHERE id = $1', [meetingId]);
            if (mConfigRes.rows.length > 0 && mConfigRes.rows[0].token_refresh_interval) {
                meetingConfig.token_refresh_interval = mConfigRes.rows[0].token_refresh_interval;
            }
        }

        if (metadonnees.token && meetingId) {
            const meetingRes = await db.query('SELECT uuid FROM meetings WHERE id = $1', [meetingId]);
            if (meetingRes.rows.length > 0) {
                const isTokenValid = this.validerTokenDynamique(meetingRes.rows[0].uuid, metadonnees.token, meetingConfig.token_refresh_interval);
                if (isTokenValid) {
                    score += 40;
                    details.token = true;
                }
            }
        }

        // 3. Facteur 2 : Géolocalisation (30 points)
        if (meetingId && metadonnees.gps) {
            try {
                const meetingRes = await db.query('SELECT geo_lat, geo_lon, geo_radius FROM meetings WHERE id = $1', [meetingId]);
                if (meetingRes.rows.length > 0) {
                    const meeting = meetingRes.rows[0];
                    if (meeting.geo_lat && meeting.geo_lon) {
                        const distance = this.calculerDistance(
                            metadonnees.gps.lat,
                            metadonnees.gps.lng,
                            parseFloat(meeting.geo_lat),
                            parseFloat(meeting.geo_lon)
                        );

                        const radius = meeting.geo_radius || 1000;
                        details.dist = Math.round(distance);

                        if (distance <= radius) {
                            score += 30;
                            details.gps = 'ok';
                        } else {
                            details.gps = 'hors_zone';
                            if (distance > 50000) score -= 30; // Très loin = Fraude possible
                        }
                    }
                }
            } catch (err) {
                console.error("Erreur validation GPS Scoring:", err);
            }
        } else {
            details.gps = 'bloque_ou_absent';
            // Tolérance : Si pas de GPS MAIS le jeton dynamique (qui tourne toutes les 30s) est valide,
            // on accorde quand même un score minimal de passage pour ne pas bloquer les utilisateurs légitimes.
            if (details.token) {
                score += 10; // Bonus compensatoire pour valider le seuil de 30
            }
        }

        // 4. Facteur 3 : Empreinte Appareil (30 points)
        const appareilRes = await db.query(
            'SELECT * FROM appareils_connus WHERE adresse_email = $1 AND empreinte_appareil = $2',
            [email, fingerprint]
        );
        if (appareilRes.rows.length > 0) {
            score += 30;
            details.appareil = 'connu';
        } else {
            details.appareil = 'nouveau';
        }

        // 5. Bonus : Challenge Code (Si fourni, il peut rattraper un GPS manquant)
        if (metadonnees.challenge_code && meetingId) {
            const mRes = await db.query('SELECT uuid FROM meetings WHERE id = $1', [meetingId]);
            if (mRes.rows.length > 0 && this.validerChallengeCode(mRes.rows[0].uuid, metadonnees.challenge_code, meetingConfig.token_refresh_interval)) {
                score += 80; // Le code de présence "écrit au tbleau" est très fort, on force le passage
                details.challenge_valid = true;
            }
        }

        metadonnees.scoring_details = details;
        const finalScore = Math.min(100, Math.max(0, score));

        console.log("=== TRACE EDR SCORING ===");
        console.log(`Email/Appareil: ${email} - ${fingerprint}`);
        console.log(`Meeting ID Interne: ${meetingId}`);
        console.log(`Details Calculés:`, JSON.stringify(details, null, 2));
        console.log(`Score brut avant bornage: ${score}`);
        console.log(`Score final généré: ${finalScore}`);
        console.log("=========================");

        return finalScore;
    },

    /**
     * Calcule la distance entre deux points GPS (en mètres) via la formule Haversine
     */
    calculerDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Rayon de la Terre en mètres
        const f1 = lat1 * Math.PI / 180;
        const f2 = lat2 * Math.PI / 180;
        const df = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(df / 2) * Math.sin(df / 2) +
            Math.cos(f1) * Math.cos(f2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    /**
     * Journaliser un événement dans le SIEM
     */
    async loggerSIEM(params) {
        const { reunionId, email, fingerprint, ip, action, score, metadonnees, decision } = params;

        const sql = `
            INSERT INTO journal_securite 
            (reunion_id, adresse_email, empreinte_appareil, ip_address, action, score_confiance_ia, metadonnees, decision)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        await db.query(sql, [
            reunionId,
            email,
            fingerprint,
            ip,
            action,
            score,
            JSON.stringify(metadonnees),
            decision
        ]);
    },

    /**
     * Génère la preuve d'intégrité pour un émargement
     */
    genererPreuveIntegrite(email, reunionUuid, timestamp) {
        const secret = process.env.SESSION_SECRET || 'osep_integrite_secret';
        const data = `${email}:${reunionUuid}:${timestamp}`;
        return crypto.createHmac('sha256', secret).update(data).digest('hex');
    }
};

module.exports = serviceSecurite;
