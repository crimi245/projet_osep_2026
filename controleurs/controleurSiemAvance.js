const db = require('../config/db');
const { EventEmitter } = require('events');
const logger = require('../utilitaires/journaliseur');

// ==========================================
// SIMULATEUR AGENT IA (EventEmitter Global)
// ==========================================
const siemEvents = new EventEmitter();

exports.siemEvents = siemEvents; // Exporté pour être écouté par serveur.js

// ==========================================
// MÉCANISME SSE - DIFFUSION TEMPS RÉEL
// ==========================================

// Connexions SSE actives pour les alertes en temps réel
let sseClients = [];

/**
 * Affiche la vue SIEM Avancé (réservée aux Super Admins)
 */
exports.getTableauDeBordAvance = async (req, res) => {
    try {
        res.render('siem-avance.html', {
            user: req.session.user
        });
    } catch (err) {
        console.error("Erreur d'affichage SIEM Avancé:", err);
        res.status(500).send("Erreur de chargement du tableau de bord SIEM Avancé.");
    }
};

/**
 * Récupère les sessions actives avec leurs empreintes JSON (Fingerprint)
 */
exports.getEmpreintesUtilisateurs = async (req, res) => {
    try {
        // On récupère les utilisateurs marqués comme actifs / connectés récemment
        // Pour la maquette, on prend tous les utilisateurs ayant une empreinte récente 
        // ou on filtre sur un état "connecté" si applicable.
        const result = await db.query(`
            SELECT id, username, full_name, role, browser_fingerprint, latitude, longitude, force_disconnect
            FROM users 
            WHERE browser_fingerprint IS NOT NULL AND deleted_at IS NULL
            ORDER BY id DESC
            LIMIT 50
        `);

        // On fusionne avec d'éventuels participants extérieurs si besoin
        const participantsRes = await db.query(`
            SELECT id, email as username, prenom || ' ' || nom as full_name, 'participant' as role, browser_fingerprint, latitude, longitude, force_disconnect
            FROM attendees
            WHERE browser_fingerprint IS NOT NULL
            ORDER BY id DESC
            LIMIT 50
        `);

        res.json({
            success: true,
            sessions: [...result.rows, ...participantsRes.rows]
        });
    } catch (err) {
        console.error("Erreur lors de la récupération des empreintes:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

/**
 * Endpoint pour récupérer la zone géographique de la réunion active actuelle
 */
exports.getActiveMeetingGeo = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, title, geo_lat, geo_lon, geo_radius 
            FROM meetings 
            WHERE deleted_at IS NULL 
              AND geo_lat IS NOT NULL
              AND start_time <= NOW() 
              AND (end_time IS NULL OR end_time >= NOW())
            ORDER BY start_time DESC 
            LIMIT 1
        `);

        if (result.rows.length > 0) {
            res.json({ success: true, meeting: result.rows[0] });
        } else {
            res.json({ success: false, message: "Aucune réunion active avec géorepérage." });
        }
    } catch (err) {
        console.error("Erreur récupération meeting geo:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

/**
 * Endpoint SSE (Server-Sent Events) pour pousser les alertes de Géorepérage
 */
exports.streamAlertes = (req, res) => {
    // Configuration de l'entête SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Établit la connexion

    // Ajoute le client à la liste
    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    sseClients.push(newClient);

    console.log(`[SIEM SSE] Super Admin connecté au flux d'alertes (Client ID: ${clientId})`);

    // Périodiquement, on pourrait interroger la base ou envoyer un "ping"
    const pingInterval = setInterval(() => {
        res.write(': ping\n\n'); // Keep-alive
    }, 30000);

    // Gérer la déconnexion
    req.on('close', () => {
        console.log(`[SIEM SSE] Connexion fermée par le client (Client ID: ${clientId})`);
        clearInterval(pingInterval);
        sseClients = sseClients.filter(c => c.id !== clientId);
    });
};

// Diffuser une alerte de géorepérage (Type natif SSE: geo_alerte)
exports.diffuserAlerteGeoreperage = (data) => {
    const payload = `event: geo_alerte\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => client.res.write(payload));
};

// Diffuser une action de l'Agent IA (Type natif SSE: action_ia)
exports.diffuserActionIA = (data) => {
    const payload = `event: action_ia\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => client.res.write(payload));
};

// ==========================================
// BINDING DES ÉVÉNEMENTS GLOBAUX
// ==========================================
siemEvents.on('ACTION_IA', (data) => {
    exports.diffuserActionIA(data);
});

/**
 * Applique une action immédiate sur une session (ex: Forcer la déconnexion, Bloquer)
 */
exports.appliquerActionIntervention = async (req, res) => {
    const { targetId, targetType, actionType, reason } = req.body;
    // targetType = 'user' | 'participant'
    // actionType = 'disconnect' | 'block'

    if (!targetId || !targetType || !actionType) {
        return res.status(400).json({ error: "Paramètres d'intervention manquants." });
    }

    try {
        const table = targetType === 'user' ? 'users' : 'attendees';

        let updateQuery = '';
        if (actionType === 'disconnect') {
            // Le middleware global va intercepter `force_disconnect = true` et détruire la session
            updateQuery = `UPDATE ${table} SET force_disconnect = true WHERE id = $1 RETURNING username`;
        } else if (actionType === 'block') {
            // Pour marquer inactif / suspendu
            updateQuery = targetType === 'user'
                ? `UPDATE users SET is_active = false, force_disconnect = true WHERE id = $1 RETURNING username`
                : `UPDATE attendees SET force_disconnect = true WHERE id = $1 RETURNING email as username`;
        } else {
            return res.status(400).json({ error: "Action non reconnue." });
        }

        const result = await db.query(updateQuery, [targetId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cible introuvable." });
        }

        // Journaliser l'action sensible
        await logger.warn(`SIEM_INTERVENTION_RAPIDE`, req.session.user.id, {
            targetId,
            targetType,
            actionType,
            reason,
            targetDisplay: result.rows[0].username
        }, req);

        res.json({ success: true, message: `Action '${actionType}' appliquée sur ${result.rows[0].username}` });

    } catch (err) {
        console.error("Erreur lors de l'application de l'action SIEM:", err);
        res.status(500).json({ error: "Erreur serveur lors de l'intervention." });
    }
};

// ==========================================
// Piloter le Bouclier OSEP (EDR / Agent IA)
// ==========================================

// Variables globales pour gérer l'état en mémoire
global.isEdrActive = true;
global.edrSeverity = 'NORMAL'; // Options: 'FAIBLE', 'NORMAL', 'STRICT'
global.bypassStaticQR = true; // Bypass pour les QR codes statiques (sans token t) actif par défaut

/**
 * Permet d'activer ou désactiver l'Agent IA de validation des présences (EDR)
 */
exports.toggleEDR = async (req, res) => {
    try {
        const { active } = req.body;
        global.isEdrActive = !!active;

        const actionType = global.isEdrActive ? "ACTIVÉ" : "DÉSACTIVÉ";

        // Journaliser l'action sensible
        await logger.warn(`SIEM_AGENT_IA_${actionType}`, req.session.user.id, {
            action: `L'Agent IA a été ${actionType} manuellement par le Super Administrateur.`
        }, req);

        res.json({ success: true, active: global.isEdrActive, severity: global.edrSeverity, bypassStaticQR: global.bypassStaticQR, message: `Bouclier EDR ${actionType}.` });

    } catch (err) {
        console.error("Erreur toggle EDR:", err);
        res.status(500).json({ error: "Erreur serveur lors du changement d'état de l'EDR." });
    }
};

/**
 * Permet d'activer ou désactiver le bypass pour les QR codes statiques
 */
exports.toggleStaticQRBypass = async (req, res) => {
    try {
        const { active } = req.body;
        global.bypassStaticQR = !!active;

        const actionType = global.bypassStaticQR ? "ACTIVÉ" : "DÉSACTIVÉ";

        // Journaliser l'action
        await logger.warn(`SIEM_STATIC_QR_BYPASS_${actionType}`, req.session.user.id, {
            action: `Le bypass des QR codes statiques a été ${actionType} manuellement.`
        }, req);

        res.json({ 
            success: true, 
            bypassStaticQR: global.bypassStaticQR, 
            message: `Bypass QR Statique ${actionType}.` 
        });

    } catch (err) {
        console.error("Erreur toggle Static QR Bypass:", err);
        res.status(500).json({ error: "Erreur serveur lors du changement d'état du bypass QR." });
    }
};

/**
 * Change le niveau de sévérité du Bouclier EDR
 */
exports.setEdrSeverity = async (req, res) => {
    try {
        const { severity } = req.body;
        if (!['FAIBLE', 'NORMAL', 'STRICT'].includes(severity)) {
            return res.status(400).json({ error: "Niveau de sévérité invalide." });
        }

        global.edrSeverity = severity;

        // Journaliser l'action sensible
        await logger.warn(`SIEM_AGENT_IA_SEVERITY`, req.session.user.id, {
            action: `Sévérité EDR modifiée à : ${severity}`
        }, req);

        res.json({ success: true, severity: global.edrSeverity, active: global.isEdrActive, message: `Sévérité EDR passée à ${severity}.` });

    } catch (err) {
        console.error("Erreur set severity EDR:", err);
        res.status(500).json({ error: "Erreur serveur lors du changement de sévérité EDR." });
    }
};

/**
 * Récupère le statut actuel du Bouclier EDR
 */
exports.getEdrStatus = (req, res) => {
    res.json({
        success: true,
        active: global.isEdrActive,
        severity: global.edrSeverity,
        bypassStaticQR: global.bypassStaticQR
    });
};

/**
 * Récupérer l'historique récent des événements de sécurité (Journal du SIEM)
 */
exports.getRefusedLogs = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, adresse_email, empreinte_appareil, action, score_confiance_ia, decision, date_evenement AS created_at, metadonnees
            FROM journal_securite
            ORDER BY date_evenement DESC
            LIMIT 100
        `);

        res.json({
            success: true,
            logs: result.rows
        });
    } catch (err) {
        console.error("Erreur récupération logs SIEM:", err);
        res.status(500).json({ error: "Erreur serveur lors de la lecture du journal." });
    }
};

