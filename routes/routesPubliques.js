const express = require('express');
const router = express.Router();
const path = require('path');
const controleurReunion = require('../controleurs/controleurReunion');

// Route d'accès principale à la réunion
router.get('/meeting/:uuid', controleurReunion.handleMeetingAccess);

router.get('/meeting/:uuid/details', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'osep2.html'));
});

router.get('/meeting/:uuid/sign', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'osep3.html'));
});

router.get('/sign/:uuid', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'osep3.html'));
});

router.get('/meeting/:uuid/print', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'osep4.html'));
});

// Route de polling pour vérifier le statut (utilisée par la salle d'attente)
router.get('/api/public/meetings/:uuid/status/poll', controleurReunion.checkMeetingStatus);

// Nouvelle route pour récupérer les détails d'un enregistrement existant
router.get('/api/public/attendee-details/:uuid', controleurReunion.getAttendeeDetails);

// Nouvelle route pour récupérer les équipes d'une coordination associées à une réunion
router.get('/api/meetings/:uuid/teams', controleurReunion.getMeetingTeams);

module.exports = router;
