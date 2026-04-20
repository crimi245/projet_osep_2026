const express = require('express');
const router = express.Router();
const controleurCoordination = require('../controleurs/controleurCoordination');
const { isAuthenticated, isAdmin } = require('../middlewares/middlewareAuth');

// Route pour récupérer la hiérarchie d'une coordination (Équipes + Membres)
router.get('/api/coordination/:id/hierarchy', isAuthenticated, isAdmin, controleurCoordination.getHierarchy);

// Route pour renommer une équipe
router.put('/api/teams/:id', isAuthenticated, isAdmin, controleurCoordination.updateTeam);

// Route pour supprimer un participant
router.delete('/api/attendees/:id', isAuthenticated, isAdmin, controleurCoordination.deleteAttendee);

module.exports = router;
