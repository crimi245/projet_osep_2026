const path = require('path');
const db = require('../config/db');

/**
 * Gère l'accès principal à une réunion via son UUID.
 * Sert soit le formulaire de participation (osep.html), soit la salle d'attente (meeting-waiting.html).
 */
exports.handleMeetingAccess = async (req, res) => {
    const { uuid } = req.params;

    try {
        // En-têtes anti-cache draconiens pour éviter de rester bloqué
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        // 1. Vérifier si l'utilisateur est déjà enregistré pour cette réunion via la session
        if (req.session && req.session.registrations && req.session.registrations[uuid]) {
            return res.sendFile(path.join(__dirname, '..', 'public', 'registered.html'));
        }

        const result = await db.query(`
            SELECT m.*, c.name as coordination_name, u.full_name as creator_name
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.uuid = $1 AND m.deleted_at IS NULL
        `, [uuid]);

        if (result.rows.length === 0) {
            return res.redirect('/dashboard');
        }

        const meeting = result.rows[0];
        const now = new Date();
        const startTime = new Date(meeting.start_time);
        const endTime = meeting.end_time ? new Date(meeting.end_time) : null;

        // Calcul de la fenêtre d'anticipation (salle d'attente)
        const waitingRoomMinutes = meeting.waiting_room_minutes || 30;
        const waitingRoomStart = new Date(startTime.getTime() - waitingRoomMinutes * 60000);

        // Déterminer si la réunion est terminée
        const isFinished = endTime && now > endTime;

        // Déterminer si l'utilisateur peut entrer (Forcé OU dans la fenêtre d'ouverture)
        const canEnter = !isFinished && (meeting.force_open === true || (now >= waitingRoomStart));

        if (isFinished) {
            // RÉUNION TERMINÉE : On redirige vers la page dédiée
            return res.render('reunion-terminee.html', {
                meeting_title: meeting.title,
                start_time: startTime.toLocaleString('fr-FR'),
                end_time: endTime.toLocaleString('fr-FR'),
                date: startTime.toLocaleDateString('fr-FR')
            });
        }

        if (canEnter) {
            // On restaure la séparation des flux demandée par l'utilisateur
            const meetingType = meeting.meeting_type;
            const isInterIntra = ['inter', 'intra'].includes(meetingType);

            if (isInterIntra) {
                // inter et intra utilisent leur propre formulaire simplifié
                return res.sendFile(path.join(__dirname, '..', 'views', 'participation-interne.html'));
            } else {
                // CCMS, CODIR et autres vers le flux osep.html (complet)
                return res.sendFile(path.join(__dirname, '..', 'public', 'osep.html'));
            }
        }

        // Par défaut, si non ouvert, on sert la salle d'attente
        return res.sendFile(path.join(__dirname, '..', 'views', 'attente-reunion.html'));

    } catch (err) {
        console.error("Erreur du contrôleur d'accès à la réunion :", err);
        res.status(500).send("Erreur serveur lors de l'accès à la réunion");
    }
};

/**
 * Point de terminaison API pour le polling du statut de la réunion.
 * Utilisé par le frontend pour détecter l'ouverture en temps réel.
 */
exports.checkMeetingStatus = async (req, res) => {
    const { uuid } = req.params;
    try {
        // En-têtes anti-cache pour le polling
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const result = await db.query('SELECT start_time, end_time, force_open, waiting_room_minutes FROM meetings WHERE uuid = $1 AND deleted_at IS NULL', [uuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion non trouvée' });
        }

        const meeting = result.rows[0];
        const now = new Date();
        const startTime = new Date(meeting.start_time);
        const endTime = meeting.end_time ? new Date(meeting.end_time) : null;

        const waitingRoomMinutes = meeting.waiting_room_minutes || 30;
        const waitingRoomStart = new Date(startTime.getTime() - waitingRoomMinutes * 60000);

        const open = meeting.force_open === true || (now >= waitingRoomStart && (!endTime || now <= endTime));

        res.json({ open });
    } catch (err) {
        console.error("Erreur du contrôleur d'interrogation de statut :", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

/**
 * Récupère les détails de l'enregistrement de l'utilisateur actuel pour une réunion.
 */
exports.getAttendeeDetails = async (req, res) => {
    const { uuid } = req.params;

    try {
        if (!req.session || !req.session.registrations || !req.session.registrations[uuid]) {
            return res.status(401).json({ error: 'Non enregistré' });
        }

        const email = req.session.registrations[uuid];

        const result = await db.query(`
            SELECT a.nom, a.prenom, a.structure, a.created_at, m.title as meeting_title
            FROM attendees a
            JOIN meetings m ON a.meeting_id = m.id
            WHERE m.uuid = $1 AND a.email = $2
            LIMIT 1
        `, [uuid, email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Détails non trouvés' });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error("Erreur récup détails enregistrement:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Récupère les équipes existantes pour la coordination liée à la réunion.
 * Utilisé pour l'auto-complétion dans le formulaire d'inscription.
 */
exports.getMeetingTeams = async (req, res) => {
    const { uuid } = req.params;
    try {
        // 1. Récupérer la coordination de la réunion
        const meetingRes = await db.query('SELECT coordination_id FROM meetings WHERE uuid = $1', [uuid]);
        if (meetingRes.rows.length === 0 || !meetingRes.rows[0].coordination_id) {
            return res.json([]); // Pas de réunion ou pas de coordination = pas d'équipes
        }

        const coordId = meetingRes.rows[0].coordination_id;

        // 2. Récupérer toutes les équipes de cette coordination
        const teamsRes = await db.query('SELECT id, name FROM teams WHERE coordination_id = $1 ORDER BY name ASC', [coordId]);
        res.json(teamsRes.rows);
    } catch (err) {
        console.error("Erreur getMeetingTeams:", err);
        res.status(500).json({ error: "Erreur lors de la récupération des équipes" });
    }
};
