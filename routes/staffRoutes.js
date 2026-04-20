const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const db = require('../config/db'); // Correction du chemin de la base de données
// Configuration de Multer pour l'upload de fichiers temporaires
const upload = multer({ dest: 'uploads/' });

// Middleware pour sécuriser toutes les routes finances (déjà géré dans serveur.js via isAuthenticated)
// router.use(...);

const controleurStaffStats = require('../controleurs/controleurStaffStats');

/**
 * GET /api/staff/stats/overview
 * Statistiques globales pour les KPIs du staff
 */
router.get('/stats/overview', controleurStaffStats.getStaffOverview);

/**
 * GET /api/staff/stats/charts
 * Données pour les graphiques du staff
 */
router.get('/stats/charts', controleurStaffStats.getStaffCharts);

/**
 * GET /api/staff/stats/per-meeting
 * Statistiques par réunion (participation, validation, montants)
 */
router.get('/stats/per-meeting', controleurStaffStats.getStaffPerMeetingStats);

/**
 * GET /api/staff/stats/alerts
 * Récupère les réunions terminées avec des validations en attente
 */
router.get('/stats/alerts', controleurStaffStats.getStaffAlerts);

/**
 * GET /api/staff/presences/:reunion_id
 * Récupère la liste des présences pour une réunion donnée (exclut les 'Rejeté' par défaut)
 */
router.get('/presences/:reunion_id', async (req, res) => {
    try {
        const { reunion_id } = req.params;
        const { sort } = req.query; // montant_asc ou montant_desc

        let orderBy = 'nom ASC';
        if (sort === 'montant_asc') orderBy = 'montant ASC NULLS LAST';
        else if (sort === 'montant_desc') orderBy = 'montant DESC NULLS LAST';

        // On récupère les présences avec récupération automatique des données historiques
        // si les champs fonction ou téléphone sont vides pour cette réunion.
        const participants = await db.query(
            `SELECT 
                a.id, a.nom, a.prenom, a.email, a.structure, a.signature, a.montant, a.signature_finale, a.statut_finance, a.statut_staff,
                COALESCE(NULLIF(a.fonction, ''), (
                    SELECT fonction FROM attendees 
                    WHERE email = a.email AND fonction IS NOT NULL AND fonction != '' 
                    ORDER BY created_at DESC LIMIT 1
                )) as fonction,
                COALESCE(NULLIF(a.telephone, ''), (
                    SELECT telephone FROM attendees 
                    WHERE email = a.email AND telephone IS NOT NULL AND telephone != '' 
                    ORDER BY created_at DESC LIMIT 1
                )) as telephone
             FROM attendees a
             WHERE a.meeting_id = $1 AND a.statut_finance != 'Rejeté'
             ORDER BY ${orderBy}`,
            [reunion_id]
        );
        res.json({ success: true, donnees: participants.rows });
    } catch (error) {
        console.error("Erreur lors de la récupération des présences finance:", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/**
 * POST /api/staff/presences
 * Ajoute manuellement un participant à la liste financière
 */
router.post('/presences', async (req, res) => {
    try {
        const { meeting_id, nom, prenom, fonction, email, structure, telephone, montant } = req.body;

        const newParticipant = await db.query(
            `INSERT INTO attendees 
            (meeting_id, nom, prenom, fonction, email, structure, telephone, montant, statut_finance, statut_staff) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'En attente', FALSE) 
            RETURNING *`,
            [meeting_id, nom, prenom, fonction, email, structure, telephone, montant]
        );
        res.json({ success: true, participant: newParticipant.rows[0] });
    } catch (error) {
        console.error("Erreur lors de l'ajout manuel:", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'ajout" });
    }
});

/**
 * PUT /api/staff/presences/:id/statut
 * Met à jour le statut_finance (ex: 'Rejeté' pour exclure du tableau final)
 */
router.put('/presences/:id/statut', async (req, res) => {
    try {
        const { id } = req.params;
        const { statut_finance } = req.body; // 'Validé', 'Rejeté', 'En attente'

        await db.query(
            `UPDATE attendees SET statut_finance = $1 WHERE id = $2`,
            [statut_finance, id]
        );
        res.json({ success: true, message: "Statut mis à jour" });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du statut:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour du statut" });
    }
});

/**
 * PUT /presences/:id
 * Met à jour les informations financières (montant, signature_finale, statut_staff)
 * Synchronise également statut_finance en fonction de statut_staff
 */
router.put('/presences/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { montant, signature_finale, statut_staff, fonction, telephone } = req.body;

        // Déterminer le nouveau statut_finance si statut_staff est fourni
        let statutFinanceUpdate = "";
        if (statut_staff !== undefined) {
            const newStatus = statut_staff ? 'Validé' : 'En attente';
            statutFinanceUpdate = `, statut_finance = '${newStatus}'`;
        }

        const cleanMontant = (montant === '' || montant === undefined) ? null : montant;

        const query = `
            UPDATE attendees 
            SET montant = $1, 
                signature_finale = $2, 
                statut_staff = $3,
                fonction = COALESCE($4, fonction),
                telephone = COALESCE($5, telephone)
                ${statutFinanceUpdate}
            WHERE id = $6
            RETURNING *`;

        const result = await db.query(query, [cleanMontant, signature_finale, statut_staff, fonction, telephone, id]);
        
        res.json({ 
            success: true, 
            message: "Informations mises à jour",
            participant: result.rows[0]
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour des infos financières:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour" });
    }
});

/**
 * POST /api/staff/rapprochement/:reunion_id
 * Reçoit un fichier Excel, extrait les noms et croise avec les inscrits de la réunion.
 */
router.post('/rapprochement/:reunion_id', upload.single('fichier'), async (req, res) => {
    try {
        const { reunion_id } = req.params;
        if (!req.file) return res.status(400).json({ success: false, message: "Fichier manquant" });
        
        const fichierPath = req.file.path;

        // 1. Lire le fichier Excel
        const workbook = xlsx.readFile(fichierPath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const donneesFichier = xlsx.utils.sheet_to_json(sheet);

        // 2. Récupérer TOUS les inscrits pour cette réunion
        const inscritsDB = await db.query(
            `SELECT * FROM attendees WHERE meeting_id = $1`,
            [reunion_id]
        );

        let matchCount = 0;
        const idsToUpdate = [];

        // 3. Croisement précis : on itère sur les inscrits
        for (const inscrit of inscritsDB.rows) {
            const nom = (inscrit.nom || '').toLowerCase().trim();
            const prenom = (inscrit.prenom || '').toLowerCase().trim();
            const email = (inscrit.email || '').toLowerCase().trim();

            const found = donneesFichier.find(row => {
                const rowStr = JSON.stringify(row).toLowerCase();
                // Match par email (plus fiable)
                if (email && rowStr.includes(email)) return true;
                // Match par Nom + Prénom
                if (nom && prenom && (rowStr.includes(nom) && rowStr.includes(prenom))) return true;
                return false;
            });

            if (found) {
                idsToUpdate.push(inscrit.id);
                matchCount++;
            }
        }

        // 4. Mettre à jour automatiquement leur statut en 'Validé' et statut_staff à true
        if (idsToUpdate.length > 0) {
            await db.query(
                `UPDATE attendees SET statut_finance = 'Validé', statut_staff = TRUE WHERE id = ANY($1::int[])`,
                [idsToUpdate]
            );
        }

        // 5. Nettoyer le fichier temporaire
        if (fs.existsSync(fichierPath)) {
            fs.unlinkSync(fichierPath);
        }

        res.json({
            success: true,
            message: `${matchCount} participants identifiés et validés.`,
            count: matchCount
        });

    } catch (error) {
        console.error("Erreur lors du rapprochement:", error);
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: "Erreur traitement du fichier" });
    }
});

module.exports = router;
