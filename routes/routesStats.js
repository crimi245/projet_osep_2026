
const express = require('express');
const router = express.Router();
const biController = require('../controleurs/controleurBI');
const { isAuthenticated, isAdmin, isStaffOrAdmin } = require('../middlewares/middlewareAuth');

// --- NOUVELLES ROUTES BI (Rapports Financiers) ---
router.get('/finance/overview', isAuthenticated, isStaffOrAdmin, biController.getGlobalFinanceStats);
router.get('/finance/export', isAuthenticated, isStaffOrAdmin, biController.exportConsolidatedFinance);

module.exports = router;
