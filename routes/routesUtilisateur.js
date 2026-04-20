
const express = require('express');
const router = express.Router();
const controleurUtilisateur = require('../controleurs/controleurUtilisateur');
const controleurCalendrier = require('../controleurs/controleurCalendrier');
const { isAuthenticated, isAdmin } = require('../middlewares/middlewareAuth');

// Calendar API
router.get('/user/calendar-events', isAuthenticated, controleurCalendrier.getUserEvents);

// We need to make sure isAuthenticated and isAdmin are available.
// In server.js they were defined inline. 
// Plan: I will create middleware/authMiddleware.js first to house them, 
// OR I will assume I need to export them from somewhere.
// Let's create middleware/authMiddleware.js as part of this step to be clean.

// Routes
router.get('/user/theme', isAuthenticated, controleurUtilisateur.getTheme);
router.post('/user/theme', isAuthenticated, controleurUtilisateur.updateTheme);
router.get('/user/me', isAuthenticated, controleurUtilisateur.getMe);

// Admin Routes
router.post('/users', isAuthenticated, isAdmin, controleurUtilisateur.createUser);
router.get('/users', isAuthenticated, isAdmin, controleurUtilisateur.getAllUsers);
router.put('/users/:id', isAuthenticated, isAdmin, controleurUtilisateur.updateUser);
router.delete('/users/:id', isAuthenticated, isAdmin, controleurUtilisateur.deleteUser);
router.get('/admin/calendar-events', isAuthenticated, isAdmin, controleurCalendrier.getAllAdminEvents);

module.exports = router;
