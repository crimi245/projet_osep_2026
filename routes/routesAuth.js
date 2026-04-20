
const express = require('express');
const router = express.Router();
const controleurAuth = require('../controleurs/controleurAuth');
const { schemas, validate } = require('../utilitaires/validateurs');

// POST /api/auth/login
router.post('/login', validate(schemas.login), controleurAuth.login);

// POST /api/auth/logout
router.post('/logout', controleurAuth.logout);

module.exports = router;
