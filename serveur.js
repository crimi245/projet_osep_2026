const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit'); // Security
const { generateStatsPDF, generateAttendancePDF } = require('./utilitaires/generateurPdf'); // PDF

require('dotenv').config();
const helmet = require('helmet');
const logger = require('./utilitaires/journaliseur'); // New Logger
const QRCode = require('qrcode'); // QR Code Generator
const multer = require('multer'); // File Uploads
const fs = require('fs'); // Système de fichiers
const { schemas, validate } = require('./utilitaires/validateurs'); // Validation Joi
const securityMiddleware = require('./middlewares/securite'); // SIEM Sécurité
const routesSecurite = require('./routes/routesSecurite'); // Routes API SIEM
const routesAuth = require('./routes/routesAuth'); // Nouvelles routes d'authentification
const routesUtilisateur = require('./routes/routesUtilisateur'); // Nouvelles routes utilisateur
const routesStats = require('./routes/routesStats'); // Nouvelles routes statistiques
const routesPubliques = require('./routes/routesPubliques'); // Nouvelles routes publiques (MVC)
const routesCoordination = require('./routes/routesCoordination'); // Nouvelles routes de coordination
const routesStaff = require('./routes/staffRoutes'); // Nouvelles routes staff
const siemAvanceController = require('./controleurs/controleurSiemAvance'); // SIEM Avancé Controller
const { isAuthenticated, isAdmin, isStaffOrAdmin } = require('./middlewares/middlewareAuth'); // Middleware d'authentification
const dynamicSidebar = require('./middlewares/barreLateraleDynamique'); // Nouveau middleware dynamique de barre latérale
const pdfGenerator = require('./utilitaires/generateurPdf');
const serviceSecurite = require('./utilitaires/serviceSecurite'); // Bouclier OSEP
const edrMiddleware = require('./middlewares/edr'); // Middleware EDR


const app = express();
// --- EJS ON HTML CONFIGURATION ---
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
app.locals.db = db; // Expose la base de données pour les routes de sécurité
const PORT = process.env.PORT || 3000;

console.log(" server démarré sur le port ");

// --- EFFICIENCY TRACKER ---
let requestStats = { total: 0, errors: 0, slow: 0, sumTime: 0 };
app.use((req, res, next) => {
    if (req.path.startsWith('/public') || req.path.startsWith('/node_modules')) return next();

    console.log("REQUÊTE :", req.method, req.path);

    const start = Date.now();
    requestStats.total++;

    res.on('finish', () => {
        const duration = Date.now() - start;
        requestStats.sumTime += duration;
        if (duration > 500) requestStats.slow++; // Lent si > 500ms
        if (res.statusCode >= 500) requestStats.errors++;
    });
    next();
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            "script-src-attr": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
            "img-src": ["'self'", "data:", "blob:", "https://ui-avatars.com", "https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://unpkg.com", "https://server.arcgisonline.com", "https://basemaps.cartocdn.com", "https://*.basemaps.cartocdn.com", "https://placehold.co", "https://*.supabase.co"],
            "connect-src": ["'self'", "ws://localhost:*", "http://localhost:*", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://nominatim.openstreetmap.org", "https://cdnjs.cloudflare.com"],
        },
    }
}));

app.use(express.urlencoded({ extended: true }));

// Limiteur de Taux - Augmenté pour l'utilisation du tableau de bord d'administration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Augmenté de 100 à 500 requêtes par fenêtre
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api/', limiter);

// Middleware de sécurité (Détection de menaces SIEM)
app.use('/api/', securityMiddleware.securityMiddleware);

// Security Admin Routes (blacklist, events, quarantine, etc.)
// Configuration de la session
app.use(session({
    secret: process.env.SESSION_SECRET || 'osep_secret_key_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Définir à true si vous utilisez HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Appliquer la barre latérale dynamique à toutes les vues
app.use(dynamicSidebar);

// Routes d'administration de la sécurité (liste noire, événements, quarantaine, etc.)
app.use('/api/admin/security', routesSecurite);

// Routes d'authentification
app.use('/api/auth', routesAuth);

// Routes de l'utilisateur
app.use('/api', routesUtilisateur);

// Routes de statistiques
app.use('/api/stats', routesStats);

const isStaffOrSuperAdmin = (req, res, next) => {
    if (req.session && req.session.user && (req.session.user.role === 'super_admin' || req.session.user.role === 'staff')) {
        return next();
    }
    res.status(403).send("Accès refusé. Niveau Staff ou Super Administrateur requis.");
};

// Routes Staff
app.use('/api/staff', isAuthenticated, isStaffOrSuperAdmin, routesStaff);

// Routes de coordination
app.use('/', routesCoordination);

// Routes publiques (Accès aux réunions MVC)
app.use('/', routesPubliques);

// Session Configuration




const isStaffOnly = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'staff') {
        return next();
    }
    res.status(403).send("Accès refusé. Niveau Staff requis.");
};

const isSuperAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'super_admin') {
        return next();
    }
    res.status(403).send("Accès refusé. Niveau Super Administrateur requis.");
};


// Middleware d'Intervention Rapide (SIEM)
const checkForceDisconnect = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const result = await db.query('SELECT force_disconnect FROM users WHERE id = $1', [req.session.user.id]);
            if (result.rows.length > 0 && result.rows[0].force_disconnect) {
                // L'utilisateur a été marqué pour déconnexion forcée par le Super Admin
                await db.query('UPDATE users SET force_disconnect = false WHERE id = $1', [req.session.user.id]); // Reset flag
                return req.session.destroy(() => {
                    res.redirect('/login?error=forced_logout');
                });
            }
        } catch (err) {
            console.error(err);
        }
    }
    next();
};

app.use(checkForceDisconnect);

// --- FICHIERS STATIQUES ---
// Le dossier public sert les ressources et la page de connexion
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public'))); // Réplique pour la racine

// --- ROUTAGE DES PAGES ---
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'super_admin') return res.redirect('/admin');
        if (req.session.user.role === 'admin') return res.redirect('/dashboard');
        if (req.session.user.role === 'staff') return res.redirect('/gestion-staff');
        return res.redirect('/user');
    }
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('connexion.html');
});

// Pages Protégées
app.get('/admin', isAuthenticated, isSuperAdmin, (req, res) => res.render('gestion-utilisateurs.html'));
app.get('/gestion-utilisateurs', isAuthenticated, isSuperAdmin, (req, res) => res.render('gestion-utilisateurs.html'));
app.get('/gestion-staff', isAuthenticated, isStaffOrSuperAdmin, (req, res) => res.render('gestion-staff.html', { user: req.session.user }));
app.get('/logs', isAuthenticated, isSuperAdmin, (req, res) => res.render('logs-securite.html'));
app.get('/stats', isAuthenticated, isAdmin, (req, res) => res.render('statistiques-globales.html'));
app.get('/stats-staff', isAuthenticated, isStaffOnly, (req, res) => res.render('statistiques-staff.html', { user: req.session.user }));
app.get('/dashboard-staff', isAuthenticated, isStaffOnly, (req, res) => res.render('dashboard-staff.html', { user: req.session.user }));
app.get('/stats-backup', isAuthenticated, isSuperAdmin, (req, res) => res.render('stats_BACKUP.html'));

// SIEM Avancé (Super Admin uniquement)
const controleurSiemAvance = require('./controleurs/controleurSiemAvance');
app.get('/siem-avance', isAuthenticated, isSuperAdmin, controleurSiemAvance.getTableauDeBordAvance);
app.get('/api/siem/empreintes', isAuthenticated, isSuperAdmin, controleurSiemAvance.getEmpreintesUtilisateurs);
app.get('/api/siem/active-meeting-geo', isAuthenticated, isSuperAdmin, controleurSiemAvance.getActiveMeetingGeo);
app.get('/api/siem/alertes/stream', isAuthenticated, isSuperAdmin, controleurSiemAvance.streamAlertes);
app.post('/api/siem/intervention', isAuthenticated, isSuperAdmin, controleurSiemAvance.appliquerActionIntervention);

// NOUVELLES ROUTES DE GESTION EDR / SIEM
app.get('/api/siem/edr-status', isAuthenticated, isSuperAdmin, controleurSiemAvance.getEdrStatus);
app.post('/api/siem/toggle-edr', isAuthenticated, isSuperAdmin, controleurSiemAvance.toggleEDR);
app.post('/api/siem/toggle-static-qr', isAuthenticated, isSuperAdmin, controleurSiemAvance.toggleStaticQRBypass);
app.post('/api/siem/severity', isAuthenticated, isSuperAdmin, controleurSiemAvance.setEdrSeverity);
app.get('/api/siem/refused-logs', isAuthenticated, isSuperAdmin, controleurSiemAvance.getRefusedLogs);


app.get('/user', isAuthenticated, (req, res) => {
    res.render('espace-utilisateur.html', { user: req.session.user });
});

app.get('/calendar', isAuthenticated, isAdmin, (req, res) => {
    res.render('calendrier-admin.html', { user: req.session.user });
});

app.get('/calendar-tailwind', isAuthenticated, isAdmin, (req, res) => {
    res.render('calendrier_tailwind.html', { user: req.session.user });
});

app.get('/dashboard', isAuthenticated, isAdmin, (req, res) => {
    // Le super_admin ne doit plus avoir accès au dashboard, on le renvoie vers sa page de gestion
    if (req.session.user.role === 'super_admin') {
        return res.redirect('/admin');
    }
    res.render('tableau-de-bord.html', { user: req.session.user });
});

// NOUVEAU : API pour récupérer les types de réunions autorisés selon la Matrice des Coordinations
app.get('/api/user-permissions', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        // Tous les profils utilisateurs peuvent créer des réunions de type 'partenaire_externe', sauf le super_admin
        let allowedTypes = [];
        if (user.role !== 'super_admin') {
            allowedTypes.push('partenaire_externe');
        }

        if (user.role === 'super_admin') {
            // Le super admin peut tout voir sauf partenaire_externe selon la demande
            allowedTypes = ['codir', 'codire', 'ccms', 'inter', 'intra'];
        } else if (user.role === 'admin') {
            // Tous les admins - autoriser TOUS les types de réunion
            allowedTypes = ['codir', 'codire', 'partenaire_externe', 'ccms', 'inter', 'intra'];
        } else if (user.role === 'staff' && (user.sigle_coordination === 'CFPSG' || parseInt(user.coordination_id) === 15 || user.coordination_name === 'CFPMG')) {
            // Staff CFPMG - inter/intra
            allowedTypes = allowedTypes.concat(['inter', 'intra']);
        } else if (user.sigle_coordination === 'CGEN' || parseInt(user.coordination_id) === 11 || user.coordination_name === 'CGEN' || (user.coordination_name && user.coordination_name.includes('GENERALE'))) {
            // Coordination Générale : CODIR + CODIRE
            allowedTypes = allowedTypes.concat(['codir', 'codire', 'inter', 'intra']);
        } else if (user.sigle_coordination === 'CCOM' || parseInt(user.coordination_id) === 17 || user.coordination_name === 'CCRPMR' || user.coordination_name === 'CCOM') {
            // Communication
            allowedTypes = allowedTypes.concat(['ccms', 'inter', 'intra', 'codire']);
        } else {
            // Autres profils
            allowedTypes = allowedTypes.concat(['inter', 'intra']);
        }

        res.json({ allowed_meeting_types: allowedTypes, user_coordination: user.coordination_name, user_sigle: user.sigile_coordination, user_role: user.role });
    } catch (err) {
        console.error('Erreur API permissions :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/participation-interne.html', (req, res) => {
    res.render('participation-interne.html');
});

app.get('/reunion-terminee.html', async (req, res) => {
    try {
        const uuid = req.query.uuid;
        if (!uuid) return res.redirect('/');

        const result = await db.query(`
            SELECT m.*, c.name as coordination_name 
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.uuid = $1 AND m.deleted_at IS NULL
        `, [uuid]);

        if (result.rows.length === 0) return res.redirect('/');

        const m = result.rows[0];
        const startTime = new Date(m.start_time);
        const endTime = m.end_time ? new Date(m.end_time) : null;

        res.render('reunion-terminee.html', {
            meeting_title: m.title,
            start_time: startTime.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            end_time: endTime ? endTime.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            date: startTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

app.get('/already-registered', (req, res) => {
    res.render('deja-inscrit.html');
});

app.get('/participation', isAuthenticated, isAdmin, (req, res) => {
    res.render('participation.html', { user: req.session.user });
});

app.get('/user/calendar', isAuthenticated, (req, res) => {
    res.render('calendrier-utilisateur.html', { user: req.session.user });
});

app.get('/participation_ut', isAuthenticated, (req, res) => {
    res.render('participation-utilisateur.html', { user: req.session.user });
});

app.get('/coordination', isAuthenticated, isAdmin, (req, res) => {
    res.render('gestion-coordinations.html', { user: req.session.user });
});

// EXPERIENCE MANAGEMENT (Accessible à tous les profils de coordination)
app.get('/experience', isAuthenticated, (req, res) => {
    res.render('gestion-experience.html', { user: req.session.user });
});

// STAFF
app.get('/staff', isAuthenticated, isStaffOrSuperAdmin, (req, res) => {
    res.render('gestion-staff.html', { user: req.session.user, sidebarFile: res.locals.sidebarFile || 'sidebar.html' });
});

// Les routes /admin, /stats, /logs sont déjà définies plus haut avec res.render

app.get('/new-meeting', isAuthenticated, (req, res) => {
    const user = req.session.user;
    const userRole = user.role;
    const typeReunion = req.query.type;

    const sigle = user.sigle_coordination || '';
    const coordName = user.coordination_name || '';
    const coordId = parseInt(user.coordination_id) || 0;

    const isSP = sigle === 'SP' || coordId === 18 || coordName === 'SP' || coordName === 'Direction' || coordName === 'Cabinet du SP';
    const isCCOM = sigle === 'CCOM' || coordId === 17 || coordName === 'CCRPMR' || coordName === 'CCOM';
    const isCGEN = sigle === 'CGEN' || coordId === 11 || coordName === 'CGEN' || (coordName && coordName.includes('GENERALE'));

    // Pour les réunions de type inter ou intra, on utilise systématiquement le formulaire utilisateur
    // car il possède l'entête "Planifiez votre prochaine session de travail" demandée.
    if (typeReunion === 'inter' || typeReunion === 'intra') {
        return res.render('nouvelle-reunion-utilisateur.html', { user });
    }

    if (typeReunion === 'ccms' && (isSP || isCCOM)) {
        return res.render('nouvelle-reunion-admin.html', { user });
    }

    if ((typeReunion === 'codir' || typeReunion === 'codire') && (isCGEN || userRole === 'super_admin' || userRole === 'admin')) {
        return res.render('nouvelle-reunion-admin.html', { user });
    }

    if (userRole === 'admin' || userRole === 'super_admin') {
        res.render('nouvelle-reunion-admin.html', { user });
    } else {
        res.render('nouvelle-reunion-utilisateur.html', { user });
    }
});

// Route explicite pour charger le formulaire de réunion de l'utilisateur pour les administrateurs
app.get('/new-meeting-user', isAuthenticated, (req, res) => {
    res.render('nouvelle-reunion-utilisateur.html', { user: req.session.user });
});

app.get('/links', isAuthenticated, (req, res) => {
    if (req.session.user.role === 'admin' || req.session.user.role === 'super_admin') {
        res.render('liens-reunion.html', { user: req.session.user });
    } else {
        res.render('liens-reunion-utilisateur.html', { user: req.session.user });
    }
});

app.get('/participation-interne.html', (req, res) => {
    res.render('participation-interne.html', { user: req.session.user });
});

app.get('/new-coordination', isAuthenticated, isAdmin, (req, res) => {
    res.render('nouvelle-coordination.html', { user: req.session.user });
});


// --- CONFIGURATION MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Point de terminaison de téléchargement
app.post('/api/upload', isAuthenticated, isAdmin, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier téléchargé' });
        }
        // Retourne le chemin public
        const publicPath = '/public/uploads/' + req.file.filename;
        res.json({ success: true, filePath: publicPath });
    } catch (err) {
        console.error("Erreur de téléchargement :", err);
        res.status(500).json({ error: err.message });
    }
});

// --- API ROUTES ---

// 1. AUTH & USERS

// MOVED HERE TO FIX CONFLICT
// GET all meetings with creator information
app.get('/api/meetings', isAuthenticated, async (req, res) => {
    try {
        const userRole = req.session.user.role;
        const userId = req.session.user.id;

        // Pagination et Filtrage
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        const { start, end } = req.query;

        let query = `
            SELECT 
                m.*,
                u.username as creator_name,
                u.full_name as creator_full_name,
                u.username,
                u.role as creator_role,
                c.name as coordination_name
            FROM meetings m
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.deleted_at IS NULL
        `;

        res.set('Cache-Control', 'no-store');

        let params = [];
        let pIdx = 1;

        // Filtrage strict par rôle (Isolation des données)
        if (userRole === 'staff') {
            // Le staff voit ses propres réunions + les réunions à incidence financière (CCMS et partenaires_externe avec impact)
            query += ` AND (m.user_id = $${pIdx++} OR m.meeting_type = 'ccms' OR (m.meeting_type = 'partenaire_externe' AND m.financial_impact = TRUE))`;
            params.push(userId);
        } else if (userRole !== 'super_admin') {
            // Seul le super_admin voit tout. Les autres ne voient que les leurs.
            query += ` AND m.user_id = $${pIdx++}`;
            params.push(userId);
        }

        // Filtrage par date (pour le calendrier)
        if (start) {
            query += ` AND m.start_time >= $${pIdx++}`;
            params.push(start);
        }
        if (end) {
            query += ` AND m.start_time <= $${pIdx++}`;
            params.push(end);
        }

        query += ` ORDER BY CASE WHEN m.start_time <= NOW() AND (m.end_time IS NULL OR m.end_time >= NOW()) THEN 0 ELSE 1 END, m.start_time DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
        params.push(limit, offset);

        // Vérification de compatibilité SQLite (Rapide et sale pour la présence d'environnement mixte dans le code)
        if (db.client && db.client.constructor.name !== 'Client') {
            // Si le pilote SQLite ne supporte pas $1... mais que le code existant l'utilisait ?
            // En supposant que le code existant était correct OU que db.query le gère.
            // Si le code existant utilisait $1, je m'y tiens.
        }

        const result = await db.query(query, params);
        console.log(`[DEBOGAGE] GET /api/meetings a retourné ${result.rows.length} lignes pour l'utilisateur ${req.session.user.username}`);

        // Mapper pour FullCalendar (attend 'start' et 'end')
        const events = result.rows.map(row => ({
            ...row,
            start: row.start_time,
            end: row.end_time || row.start_time // solution de repli si end est nul
        }));

        res.json(events);
    } catch (err) {
        console.error('Erreur récup réunions:', err);
        res.status(500).json({ error: err.message });
    }
});

// 1. AUTH & USERS
// Auth routes are now handled by /api/auth in authRoutes.js








// METTRE À JOUR LA RÉUNION (PUT)
app.put('/api/meetings/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { start, end, theme_color, bg_type, bg_value, active_game, force_open, waiting_room_minutes } = req.body;
        const userId = req.session.user.id;

        // 1. Récupérer l'état actuel pour comparaison et vérification des droits
        const currentMeetingRes = await db.query('SELECT * FROM meetings WHERE id = $1', [id]);
        if (currentMeetingRes.rows.length === 0) return res.status(404).json({ error: "Réunion non trouvée" });
        const currentMeeting = currentMeetingRes.rows[0];

        // Vérifier la propriété (Sauf Super Admin)
        const userRole = req.session.user.role;
        if (userRole !== 'super_admin' && currentMeeting.user_id !== userId) {
            return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres réunions." });
        }

        // 2. Construire la requête dynamique
        let updates = [];
        let params = [];
        let pIdx = 1;

        let changedFields = {};

        if (start && start !== currentMeeting.start_time?.toISOString()) {
            updates.push(`start_time = $${pIdx++}`); params.push(start);
            changedFields.start_time = { old: currentMeeting.start_time, new: start };
        }
        if (end && end !== currentMeeting.end_time?.toISOString()) {
            updates.push(`end_time = $${pIdx++}`); params.push(end);
            changedFields.end_time = { old: currentMeeting.end_time, new: end };
        }
        if (theme_color !== undefined && theme_color !== currentMeeting.theme_color_override) {
            updates.push(`theme_color_override = $${pIdx++}`); params.push(theme_color);
            changedFields.theme_color = { old: currentMeeting.theme_color_override, new: theme_color };
        }
        if (bg_type !== undefined && bg_type !== currentMeeting.background_type) {
            updates.push(`background_type = $${pIdx++}`); params.push(bg_type);
            changedFields.bg_type = { old: currentMeeting.background_type, new: bg_type };
        }
        if (bg_value !== undefined && bg_value !== currentMeeting.background_value) {
            updates.push(`background_value = $${pIdx++}`); params.push(bg_value);
            changedFields.bg_value = { old: currentMeeting.background_value, new: bg_value };
        }
        if (active_game !== undefined && active_game !== currentMeeting.active_game) {
            updates.push(`active_game = $${pIdx++}`); params.push(active_game);
            changedFields.active_game = { old: currentMeeting.active_game, new: active_game };
        }
        if (force_open !== undefined && force_open !== currentMeeting.force_open) {
            updates.push(`force_open = $${pIdx++}`); params.push(force_open);
            changedFields.force_open = { old: currentMeeting.force_open, new: force_open };
        }
        if (waiting_room_minutes !== undefined && waiting_room_minutes !== currentMeeting.waiting_room_minutes) {
            updates.push(`waiting_room_minutes = $${pIdx++}`); params.push(waiting_room_minutes);
            changedFields.waiting_room_minutes = { old: currentMeeting.waiting_room_minutes, new: waiting_room_minutes };
        }
        if (req.body.token_refresh_interval !== undefined && req.body.token_refresh_interval !== currentMeeting.token_refresh_interval) {
            updates.push(`token_refresh_interval = $${pIdx++}`); params.push(req.body.token_refresh_interval);
            changedFields.token_refresh_interval = { old: currentMeeting.token_refresh_interval, new: req.body.token_refresh_interval };
        }

        if (updates.length === 0) return res.json({ success: true, message: "Aucun changement" });

        // Incrémenter le nombre de modifications
        updates.push(`nombre_modifications = COALESCE(nombre_modifications, 0) + 1`);

        params.push(id);
        const query = `UPDATE meetings SET ${updates.join(', ')} WHERE id = $${pIdx} RETURNING *`;

        const result = await db.query(query, params);

        // 3. Insérer dans l'historique
        if (Object.keys(changedFields).length > 0) {
            await db.query(`
                INSERT INTO historique_modifications_reunions (reunion_id, utilisateur_id, action, details)
                VALUES ($1, $2, 'UPDATE', $3)
            `, [id, userId, JSON.stringify(changedFields)]);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Erreur de mise à jour de la réunion :", err);
        res.status(500).json({ error: err.message });
    }
});

// Supprimer l'utilisateur (SUPPRESSION LOGIQUE)



// Obtenir les informations de l'utilisateur actuel


// Obtenir la prochaine réunion en cours pour le tableau de bord
app.get('/api/dashboard/current-meeting', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        // Trouver la réunion future la plus proche OU une réunion actuellement active
        // Logique: active maintenant OU future, triée par start_time
        let query = `
            SELECT * FROM meetings 
            WHERE end_time >= NOW() 
            AND deleted_at IS NULL
        `;
        let params = [];

        if (req.session.user.role === 'admin') {
            query += ` AND (user_id = $1 OR coordination_id = $2)`;
            params = [userId, req.session.user.coordination_id];
        } else if (req.session.user.role === 'super_admin') {
            // Voit tout
        } else {
            query += ` AND user_id = $1`;
            params = [userId];
        }

        query += ` ORDER BY start_time ASC LIMIT 1`;
        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.json(null); // Pas de réunion
        }

        const m = result.rows[0];
        // Ajouter un statut calculé pour le front-end
        const now = new Date();
        m.status = (now >= new Date(m.start_time) && now <= new Date(m.end_time)) ? 'active' : 'upcoming';

        res.json(m);
    } catch (err) {
        console.error("Erreur de réunion du tableau de bord :", err);
        res.status(500).json({ error: err.message });
    }
});

// Obtenir les statistiques de l'utilisateur (Dynamique & Privé)
app.get('/api/stats/user', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Obtenir le nombre total de réunions créées par l'utilisateur
        const meetingsResult = await db.query(`
            SELECT COUNT(*) as total, 
                   COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) as duration
            FROM meetings 
            WHERE user_id = $1 AND deleted_at IS NULL
        `, [userId]);

        const totalMeetings = parseInt(meetingsResult.rows[0].total) || 0;
        const totalDuration = parseFloat(meetingsResult.rows[0].duration).toFixed(1) || '0.0';

        // Calculer le taux de participation
        // Logique : Pour chaque réunion, nous aurions besoin du nombre de participants attendus vs les participants réels.
        // Pour l'instant, si nous n'avons pas le champ "participants attendus", nous pourrions regarder les invitations vs les participants ?
        // Ou simplement retourner 0/NULL si nous ne pouvons pas encore le calculer, pour être "dynamique" mais honnête.
        // Supposons pour l'instant que nous n'avons pas de compte "attendu" fiable facilement accessible sans une requête plus complexe.
        // Nous retournerons 0 ou null pour indiquer "Pas assez de données" au lieu d'un faux 85%.

        let attendanceRate = null;
        if (totalMeetings > 0) {
            // Espace réservé pour le calcul réel si les données existaient
            // Pour l'instant, regardons s'il y a DES participants pour les réunions de cet utilisateur
            const attendeesCount = await db.query(`
                SELECT COUNT(*) FROM attendees a 
                JOIN meetings m ON a.meeting_id = m.id 
                WHERE m.user_id = $1
             `, [userId]);

            // Si nous avons des participants, peut-être pouvons-nous simuler un faux "dynamique" basé sur la moyenne par réunion ?
            // Ou simplement le laisser à nul pour afficher "N/A" sur le front-end comme demandé pour les "états vides".
            if (parseInt(attendeesCount.rows[0].count) > 0) {
                // Faux calcul pour le rendre vivant mais spécifique à l'utilisateur :
                // par ex. (participants / (réunions * 10)) * 100 plafonné à 100 ?
                // Non, soyons propres. Si pas de données réelles, envoyons null.
                attendanceRate = null;
            }
        }

        // Obtenir les réunions récentes (Spécifique à l'utilisateur)
        const recentMeetingsResult = await db.query(`
            SELECT id, title, start_time, end_time, location
            FROM meetings
            WHERE user_id = $1 AND deleted_at IS NULL
            ORDER BY start_time DESC
            LIMIT 5
        `, [userId]);

        res.json({
            totalMeetings,
            totalDuration,
            attendanceRate, // Peut être nul
            recentMeetings: recentMeetingsResult.rows
        });
    } catch (err) {
        await logger.error('ERREUR_STATS_UTILISATEUR', req.session.user?.id || null, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
});

// Obtenir les données des réunions de l'utilisateur pour le graphique
app.get('/api/stats/user/meetings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Obtenir le nombre de réunions par date pour les 30 derniers jours
        const result = await db.query(`
            SELECT 
                DATE(start_time) as date,
                COUNT(*) as count
            FROM meetings
            WHERE user_id = $1 
                AND deleted_at IS NULL
                AND start_time >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(start_time)
            ORDER BY date ASC
        `, [userId]);

        // Formater les dates pour la locale française
        const data = result.rows.map(row => ({
            date: new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            count: parseInt(row.count)
        }));

        res.json(data);
    } catch (err) {
        await logger.error('ERREUR_GRAPHIQUE_REUNIONS_UTILISATEUR', req.session.user?.id || null, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
});

// Obtenir les statistiques de participation pour le graphique et KPI
app.get('/api/stats/participation', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { period } = req.query; // 'week', 'month', 'year'

        let interval = "INTERVAL '7 days'";
        let dateFormat = 'DD/MM';

        if (period === 'month') {
            interval = "INTERVAL '30 days'";
            dateFormat = 'DD/MM';
        } else if (period === 'year') {
            interval = "INTERVAL '1 year'";
            dateFormat = 'MM/YYYY';
        }

        // 1. Données du graphique: Réunions et participants par date
        const chartQuery = `
            SELECT 
                TO_CHAR(date_trunc('day', m.start_time), 'YYYY-MM-DD') as date_label,
                COUNT(DISTINCT m.id) as meetings_count,
                COUNT(a.id) as attendees_count
            FROM meetings m
            LEFT JOIN attendees a ON m.id = a.meeting_id
            WHERE m.user_id = $1 
              AND m.deleted_at IS NULL
              AND m.start_time >= NOW() - ${interval}
            GROUP BY date_label
            ORDER BY date_label ASC
        `;

        const chartResult = await db.query(chartQuery, [userId]);

        const labels = [];
        const meetingsData = [];
        const attendeesData = [];
        let totalMeetings = 0;
        let totalAttendees = 0;

        chartResult.rows.forEach(row => {
            labels.push(new Date(row.date_label).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
            meetingsData.push(parseInt(row.meetings_count));
            attendeesData.push(parseInt(row.attendees_count));

            totalMeetings += parseInt(row.meetings_count);
            totalAttendees += parseInt(row.attendees_count);
        });

        // 2. Calculer le taux de participation (Moyenne de participants par réunion)
        // Remarque : Le vrai "taux" nécessite (Participants / Invités). Étant donné que nous n'avons pas "Invités",
        // nous retournerons la moyenne de participants par réunion comme KPI, ou 0 si aucune réunion.
        const attendanceRate = totalMeetings > 0 ? (totalAttendees / totalMeetings).toFixed(1) : "0";

        res.json({
            labels: labels,
            meetings: meetingsData,
            attendees: attendeesData,
            attendanceRate: attendanceRate, // Envoyé sous forme de chaîne "X.X"
            totalMeetings,
            totalAttendees
        });

    } catch (err) {
        console.error("Erreur de statistiques de participation :", err);
        res.status(500).json({ error: err.message });
    }
});

// Obtenir les statistiques spécifiques à l'utilisateur pour participation_ut.html
app.get('/api/stats/my', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // 1. Obtenir le nombre total de réunions
        const meetingsRes = await db.query(
            'SELECT COUNT(*) FROM meetings WHERE user_id = $1',
            [userId]
        );

        // 2. Obtenir le nombre total de participants (en utilisant la table attendees)
        const participantsRes = await db.query(`
            SELECT COUNT(*) 
            FROM attendees a
            JOIN meetings m ON a.meeting_id = m.id
            WHERE m.user_id = $1
        `, [userId]);

        // 3. Obtenir les 5 principaux participants
        const topParticipantsRes = await db.query(`
            SELECT 
                TRIM(BOTH ' ' FROM (COALESCE(a.prenom, '') || ' ' || COALESCE(a.nom, ''))) as name, 
                COUNT(*) as count
            FROM attendees a
            JOIN meetings m ON a.meeting_id = m.id
            WHERE m.user_id = $1
            GROUP BY name
            ORDER BY count DESC
            LIMIT 5
        `, [userId]);

        // 4. Obtenir les 20 dernières réunions avec le nombre de participants (pour le graphique)
        const meetingsDataRes = await db.query(`
            SELECT 
                m.title, 
                m.start_time, 
                COUNT(a.id) as participant_count
            FROM meetings m
            LEFT JOIN attendees a ON m.id = a.meeting_id
            WHERE m.user_id = $1
            GROUP BY m.id
            ORDER BY m.start_time ASC
            LIMIT 20
        `, [userId]);

        // Formater les dates pour le graphique
        const meetingsData = meetingsDataRes.rows.map(row => ({
            title: row.title,
            date: new Date(row.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            count: parseInt(row.participant_count)
        }));

        res.json({
            meetings: parseInt(meetingsRes.rows[0].count),
            participants: parseInt(participantsRes.rows[0].count),
            topParticipants: topParticipantsRes.rows,
            meetingsData: meetingsData
        });
    } catch (err) {
        await logger.error('ERREUR_MES_STATS_UTILISATEUR', req.session.user?.id || null, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
});


// Obtenir les réunions de l'utilisateur (toutes)
app.get('/api/meetings/my', isAuthenticated, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const userId = req.session.user.id;
        const result = await db.query(`
            SELECT m.*, u.username, u.full_name as creator_name
            FROM meetings m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.user_id = $1 AND m.deleted_at IS NULL
            ORDER BY CASE WHEN m.start_time <= NOW() AND (m.end_time IS NULL OR m.end_time >= NOW()) THEN 0 ELSE 1 END, m.start_time DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Limiteur de taux pour l'interrogation des journaux
const logsLimiter = rateLimit({
    windowMs: 2000, // 2 seconds
    max: 5, // limiter chaque IP à 5 requêtes par windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." }
});

// 1. Statistiques des journaux (KPIs & Graphiques)
app.get('/api/admin/logs/stats', isAuthenticated, isAdmin, logsLimiter, async (req, res) => {
    try {
        const period = req.query.period || '24h';
        let dateFilter = "NOW() - INTERVAL '24 hours'";
        if (period === '7d') dateFilter = "NOW() - INTERVAL '7 days'";
        if (period === '30d') dateFilter = "NOW() - INTERVAL '30 days'";
        if (period === 'all') dateFilter = "'2020-01-01'"; // Date dans un passé lointain

        // KPIs
        const totalEventsRes = await db.query(`SELECT COUNT(*) FROM system_logs WHERE created_at >= ${dateFilter}`);
        const errorEventsRes = await db.query(`SELECT COUNT(*) FROM system_logs WHERE level = 'ERROR' AND created_at >= ${dateFilter}`);
        const criticalRes = await db.query(`SELECT COUNT(*) FROM system_logs WHERE level = 'CRITICAL' AND created_at >= ${dateFilter}`);
        const distinctUsersRes = await db.query(`SELECT COUNT(DISTINCT user_id) FROM system_logs WHERE created_at >= ${dateFilter}`);

        const totalEvents = parseInt(totalEventsRes.rows[0].count);
        const errorCount = parseInt(errorEventsRes.rows[0].count);
        const errorRate = totalEvents > 0 ? ((errorCount / totalEvents) * 100).toFixed(1) : 0;

        // Ventilation horaire (pour le graphique)
        // Grouper par heure. Postgres: date_trunc('hour', created_at)
        const hourlyRes = await db.query(`
            SELECT date_trunc('hour', created_at) as hour, COUNT(*) as count
            FROM system_logs 
            WHERE created_at >= ${dateFilter}
            GROUP BY hour 
            ORDER BY hour ASC
        `);

        // Actions principales
        const topActionsRes = await db.query(`
            SELECT action, COUNT(*) as count 
            FROM system_logs 
            WHERE created_at >= ${dateFilter}
            GROUP BY action 
            ORDER BY count DESC 
            LIMIT 5
        `);

        // Utilisateurs principaux
        const topUsersRes = await db.query(`
            SELECT u.username, u.full_name, COUNT(*) as count 
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.created_at >= ${dateFilter} AND l.user_id IS NOT NULL
            GROUP BY u.id, u.username, u.full_name
            ORDER BY count DESC 
            LIMIT 5
        `);

        res.json({
            totalEvents,
            errorRate,
            criticalAlerts: parseInt(criticalRes.rows[0].count),
            activeUsers: parseInt(distinctUsersRes.rows[0].count),
            hourlyBreakdown: hourlyRes.rows,
            topActions: topActionsRes.rows,
            topUsers: topUsersRes.rows
        });

    } catch (err) {
        console.error("Erreur stats journaux :", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Tous les journaux avec filtres
app.get('/api/admin/logs', isAuthenticated, isAdmin, logsLimiter, async (req, res) => {
    try {
        const { level, action, user_id, start_date, end_date, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT l.*, u.username, u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let pIdx = 1;

        if (level) {
            query += ` AND l.level = $${pIdx++}`;
            params.push(level);
        }
        if (action) {
            query += ` AND l.action ILIKE $${pIdx++}`;
            params.push(`%${action}%`);
        }
        if (user_id) {
            query += ` AND l.user_id = $${pIdx++}`;
            params.push(user_id);
        }
        if (start_date) {
            query += ` AND l.created_at >= $${pIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND l.created_at <= $${pIdx++}`;
            params.push(end_date);
        }

        query += ` ORDER BY l.created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error("Erreur récup logs:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. COORDINATIONS

app.get('/api/coordinations', isAuthenticated, async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*,
                (SELECT COUNT(m.id) FROM meetings m WHERE m.coordination_id = c.id AND m.deleted_at IS NULL) as meeting_count,
                (SELECT COUNT(a.id) FROM attendees a JOIN meetings m ON a.meeting_id = m.id WHERE m.coordination_id = c.id AND m.deleted_at IS NULL) as member_count
            FROM coordinations c
            ORDER BY c.name ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur api coordinations:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/coordinations', isAuthenticated, isAdmin, async (req, res) => {
    const { name, sigle_coordination, head, teams } = req.body;
    try {
        await db.query('BEGIN');

        const coordResult = await db.query(
            'INSERT INTO coordinations (name, sigle_coordination, head_name) VALUES ($1, $2, $3) RETURNING *',
            [name, sigle_coordination, head || null]
        );
        const coordinationId = coordResult.rows[0].id;

        if (teams && Array.isArray(teams)) {
            for (const team of teams) {
                const teamResult = await db.query(
                    'INSERT INTO teams (name, coordination_id) VALUES ($1, $2) RETURNING id',
                    [team.name, coordinationId]
                );
                const teamId = teamResult.rows[0].id;

                if (team.members && Array.isArray(team.members)) {
                    for (const member of team.members) {
                        await db.query(
                            'INSERT INTO coordination_members (coordination_id, name, role, team_id) VALUES ($1, $2, $3, $4)',
                            [coordinationId, member.name, member.role || null, teamId]
                        );
                    }
                }
            }
        }

        // Membres sans équipe
        if (req.body.independent_members && Array.isArray(req.body.independent_members)) {
            for (const member of req.body.independent_members) {
                await db.query(
                    'INSERT INTO coordination_members (coordination_id, name, role, team_id) VALUES ($1, $2, $3, NULL)',
                    [coordinationId, member.name, member.role || null]
                );
            }
        }

        await db.query('COMMIT');
        res.status(201).json(coordResult.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erreur création coordination:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/coordinations/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, sigle_coordination, head, teams, independent_members } = req.body;
    try {
        await db.query('BEGIN');

        const result = await db.query(
            'UPDATE coordinations SET name = $1, sigle_coordination = $2, head_name = $3 WHERE id = $4 RETURNING *',
            [name, sigle_coordination, head || null, id]
        );

        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Coordination non trouvée' });
        }

        // Pour simplifier la mise à jour des structures imbriquées (équipes/membres), 
        // on supprime l'existant et on réinsère la nouvelle structure.
        // NOTE: Cela suppose que les IDs de ces membres ne sont pas référencés ailleurs de manière persistante 
        // ou qu'on gère la cascade. coordination_members et teams sont liés ici.

        await db.query('DELETE FROM coordination_members WHERE coordination_id = $1', [id]);
        await db.query('DELETE FROM teams WHERE coordination_id = $1', [id]);

        if (teams && Array.isArray(teams)) {
            for (const team of teams) {
                const teamResult = await db.query(
                    'INSERT INTO teams (name, coordination_id) VALUES ($1, $2) RETURNING id',
                    [team.name, id]
                );
                const teamId = teamResult.rows[0].id;

                if (team.members && Array.isArray(team.members)) {
                    for (const member of team.members) {
                        await db.query(
                            'INSERT INTO coordination_members (coordination_id, name, role, team_id) VALUES ($1, $2, $3, $4)',
                            [id, member.name, member.role || null, teamId]
                        );
                    }
                }
            }
        }

        if (independent_members && Array.isArray(independent_members)) {
            for (const member of independent_members) {
                await db.query(
                    'INSERT INTO coordination_members (coordination_id, name, role, team_id) VALUES ($1, $2, $3, NULL)',
                    [id, member.name, member.role || null]
                );
            }
        }

        await db.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erreur mise à jour coordination:", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/coordinations/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Commencer une transaction pour garantir l'intégrité des données
        await db.query('BEGIN');

        // 1. Désassigner les utilisateurs de cette coordination
        await db.query('UPDATE users SET coordination_id = NULL WHERE coordination_id = $1', [id]);

        // 2. Désassigner les réunions de cette coordination
        await db.query('UPDATE meetings SET coordination_id = NULL WHERE coordination_id = $1', [id]);

        // 3. Supprimer la coordination (les tables avec ON DELETE CASCADE comme coordination_members et teams suivront)
        const result = await db.query('DELETE FROM coordinations WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Coordination non trouvée' });
        }

        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Erreur lors de la suppression de la coordination:", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. RÉUNIONS (Créer, Mettre à jour, Supprimer)

app.post('/api/meetings', isAuthenticated, async (req, res) => {
    const {
        title,
        start_time,
        end_time,
        location,
        coordination_id,
        description,
        theme_color,
        background_type,
        background_value,
        active_game,
        waiting_room_minutes,
        meeting_type,
        meeting_category,
        priority,
        geo_lat,
        geo_lon,
        geo_radius,
        financial_impact
    } = req.body;

    try {
        const user_id = (req.session.user.role === 'admin' && req.body.user_id) ? req.body.user_id : req.session.user.id;

        // Déterminer coordination_id
        let finalCoordinationId = coordination_id;
        if (req.session.user.role !== 'admin') {
            // Utilisateurs réguliers : utiliser leur propre coordination
            finalCoordinationId = req.session.user.coordination_id;
        }

        // --- VALIDATION DE LA MATRICE DES DROITS POUR LA CRÉATION ---
        const user = req.session.user;
        let allowedTypes = [];

        // Tous les profils utilisateurs peuvent créer des réunions de type 'partenaire_externe'
        allowedTypes.push('partenaire_externe');

        if (user.role === 'super_admin') {
            return res.status(403).json({ error: "L'administrateur système ne peut pas créer de réunions." });
        }

        // SP est un profil administrateur spécial qui doit pouvoir créer tous les types de réunions
        if (user.role === 'admin' && (user.sigle_coordination === 'SP' || [18].includes(parseInt(user.coordination_id)) || user.coordination_name === 'SP' || user.coordination_name === 'Direction' || user.coordination_name === 'Cabinet du SP')) {
            allowedTypes = ['codir', 'partenaire_externe', 'ccms', 'inter', 'intra'];
        } else if (user.role === 'admin') {
            // Autres admins - autoriser CCMS, Inter, Intra (partenaire_externe déjà ajouté)
            allowedTypes = allowedTypes.concat(['ccms', 'inter', 'intra']);
        } else if (user.role === 'staff' && (user.sigle_coordination === 'CFPSG' || parseInt(user.coordination_id) === 15 || user.coordination_name === 'CFPMG')) {
            // Staff CFPMG (ID 15) - uniquement inter/intra (partenaire_externe déjà ajouté)
            allowedTypes = allowedTypes.concat(['inter', 'intra']);
        } else if (user.sigle_coordination === 'CGEN' || parseInt(user.coordination_id) === 11 || user.coordination_name === 'CGEN' || (user.coordination_name && user.coordination_name.includes('GENERALE'))) {
            // Coordination Générale (ID 11)
            allowedTypes = allowedTypes.concat(['codir', 'inter', 'intra']);
        } else if (user.sigle_coordination === 'CCOM' || parseInt(user.coordination_id) === 17 || user.coordination_name === 'CCRPMR' || user.coordination_name === 'CCOM') {
            // Communication (ID 17)
            allowedTypes = allowedTypes.concat(['ccms', 'inter', 'intra']);
        } else {
            // Tous les autres profils (CSO, CEVS, etc.)
            allowedTypes = allowedTypes.concat(['inter', 'intra']);
        }

        if (!allowedTypes.includes(meeting_type)) {
            return res.status(403).json({ error: `Vous n'avez pas les droits pour créer une réunion de type: ${meeting_type}` });
        }
        // -----------------------------------------------------------

        const result = await db.query(
            `INSERT INTO meetings 
            (title, start_time, end_time, location, coordination_id, user_id, description, 
             theme_color_override, background_type, background_value, active_game, waiting_room_minutes,
             meeting_type, meeting_category, priority, geo_lat, geo_lon, geo_radius, financial_impact) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
            RETURNING *`,
            [
                title,
                start_time,
                end_time || null,
                location || null,
                finalCoordinationId || null,
                user_id,
                description || null,
                theme_color || null,
                background_type || 'color',
                background_value || null,
                active_game || null,
                waiting_room_minutes || 30,
                meeting_type || 'intra',
                meeting_category || 'Autre',
                priority || 'medium',
                geo_lat || null,
                geo_lon || null,
                geo_radius || 0,
                financial_impact || false
            ]
        );

        const meeting = result.rows[0];

        // Générer le code QR
        const meetingUrl = `${req.protocol}://${req.get('host')}/meeting/${meeting.uuid}`;
        const qrCodeDataUrl = await QRCode.toDataURL(meetingUrl);

        // Enregistrer la création de la réunion
        await logger.info('REUNION_CREEE', user_id, {
            meeting_id: meeting.id,
            meeting_title: title,
            coordination_id: finalCoordinationId
        }, req);

        res.status(201).json({
            ...meeting,
            qr_code: qrCodeDataUrl,
            meeting_url: meetingUrl
        });
    } catch (err) {
        console.error("Erreur de création de la réunion :", err);
        await logger.error('ERREUR_CREATION_REUNION', req.session.user.id, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
});

// SUPPRIMER LA RÉUNION (Suppression logique)
app.delete('/api/meetings/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user.id;
        const userRole = req.session.user.role;

        // Vérifier la propriété ou l'administrateur
        const checkResult = await db.query('SELECT user_id FROM meetings WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion non trouvée' });
        }

        const meetingOwnerId = checkResult.rows[0].user_id;
        if (userRole !== 'admin' && meetingOwnerId !== userId) {
            return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres réunions' });
        }

        // Soft delete
        await db.query('UPDATE meetings SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

        await logger.warn('REUNION_SUPPRIMEE', userId, { meeting_id: id }, req);

        res.json({ success: true, message: 'Réunion supprimée avec succès' });
    } catch (err) {
        await logger.error('ERREUR_SUPPRESSION_REUNION', req.session.user.id, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
});

// SUPPRESSION EN LOT DES RÉUNIONS
app.post('/api/meetings/bulk-delete', isAuthenticated, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs invalides' });
        }

        const userId = req.session.user.id;
        const userRole = req.session.user.role;

        // Vérifier la propriété pour chaque réunion
        const checkResult = await db.query(
            'SELECT id, user_id FROM meetings WHERE id = ANY($1) AND deleted_at IS NULL',
            [ids]
        );

        const allowedIds = checkResult.rows
            .filter(row => userRole === 'admin' || row.user_id === userId)
            .map(row => row.id);

        if (allowedIds.length === 0) {
            return res.status(403).json({ error: 'Aucune réunion autorisée à supprimer' });
        }

        // Suppression logique
        await db.query('UPDATE meetings SET deleted_at = CURRENT_TIMESTAMP WHERE id = ANY($1)', [allowedIds]);

        await logger.warn('REUNIONS_SUPPRIMEES_EN_LOT', userId, { meeting_ids: allowedIds, count: allowedIds.length }, req);

        res.json({ success: true, deleted: allowedIds.length, message: `${allowedIds.length} réunion(s) supprimée(s)` });
    } catch (err) {
        await logger.error('ERREUR_SUPPRESSION_REUNIONS_EN_LOT', req.session.user.id, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
});

// 4. PARTICIPANTS

app.get('/api/attendees', isAuthenticated, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.*, m.title as meeting_title 
            FROM attendees a 
            LEFT JOIN meetings m ON a.meeting_id = m.id 
            WHERE m.deleted_at IS NULL
            ORDER BY a.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/stats/top-attendees
 * Calcule réellement les participants les plus assidus (Top 3)
 * Normalisation par email, nom et prénom (casse et espaces ignorés)
 */
app.get('/api/stats/top-attendees', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                LOWER(TRIM(nom)) as nom, 
                LOWER(TRIM(prenom)) as prenom, 
                COUNT(*) as count 
            FROM attendees 
            GROUP BY LOWER(TRIM(nom)), LOWER(TRIM(prenom)) 
            ORDER BY count DESC 
            LIMIT 3
        `);

        const formatWord = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        const formatName = (s) => s ? s.split(' ').map(formatWord).join(' ') : '';
        
        const formatted = result.rows.map(r => ({
            nom: formatName(r.nom),
            prenom: formatName(r.prenom),
            count: parseInt(r.count)
        }));
        res.json(formatted);
    } catch (err) {
        console.error("Erreur stats top-attendees:", err);
        res.status(500).json({ error: err.message });
    }
});


app.post('/api/attendees', async (req, res) => {
    const { meeting_id, nom, prenom, email, phone, organization } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO attendees (meeting_id, nom, prenom, email, phone, organization) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [meeting_id, nom || null, prenom || null, email || null, phone || null, organization || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. STATISTIQUES ET ANALYSES

// Assistant : Récupérer les statistiques globales
async function fetchGlobalStats(period = '7d') {
    let dateFilter = "NOW() - INTERVAL '7 days'";
    if (period === '30d') dateFilter = "NOW() - INTERVAL '30 days'";
    if (period === '90d') dateFilter = "NOW() - INTERVAL '90 days'";

    // 1. KPIs GLOBAUX
    const totalHoursRes = await db.query(`
        SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as total_hours 
        FROM meetings 
        WHERE end_time IS NOT NULL AND deleted_at IS NULL AND start_time >= ${dateFilter}
    `);
    const totalHours = Math.round(parseFloat(totalHoursRes.rows[0].total_hours || 0));


    // Appareils
    const devicesRes = await db.query(`
        SELECT device_type, COUNT(*) as count 
        FROM login_logs 
        WHERE login_time >= ${dateFilter}
        GROUP BY device_type
    `);
    let desktop = 0, mobile = 0;
    devicesRes.rows.forEach(r => {
        if (r.device_type === 'mobile') mobile += parseInt(r.count);
        else desktop += parseInt(r.count);
    });
    const totalLogins = desktop + mobile;
    const devices = {
        desktop: totalLogins ? Math.round((desktop / totalLogins) * 100) : 0,
        mobile: totalLogins ? Math.round((mobile / totalLogins) * 100) : 0
    };

    // 2. JOURNAUX
    const logsRes = await db.query(`
        SELECT 'system' as source, action as text, created_at, 'info' as type
        FROM system_logs 
        WHERE created_at >= ${dateFilter}
        ORDER BY created_at DESC 
        LIMIT 6
    `);
    let logs = logsRes.rows.map(l => ({ ...l, type: l.text.includes('MEETING') ? 'meeting' : 'system' }));

    // 3. TENDANCES
    const trendsRes = await db.query(`
        SELECT 
            DATE(m.start_time) as day, 
            COUNT(DISTINCT m.id) as count,
            COUNT(a.id) as attendees
        FROM meetings m
        LEFT JOIN attendees a ON m.id = a.meeting_id
        WHERE m.start_time >= ${dateFilter} AND m.deleted_at IS NULL
        GROUP BY DATE(m.start_time)
        ORDER BY day ASC
    `);
    const trends = trendsRes.rows.map(r => ({
        day: new Date(r.day).toLocaleDateString('fr-FR', { weekday: 'short' }),
        count: parseInt(r.count),
        attendees: parseInt(r.attendees)
    }));

    // 4. RADAR
    const radarRes = await db.query(`
        SELECT c.sigle_coordination, COUNT(m.id) as count
        FROM meetings m
        JOIN coordinations c ON m.coordination_id = c.id
        WHERE m.start_time >= ${dateFilter} AND m.deleted_at IS NULL
        GROUP BY c.sigle_coordination
        ORDER BY count DESC
        LIMIT 5
    `);
    const radar = radarRes.rows.map(r => ({
        name: r.sigle_coordination || 'N/A',
        count: parseInt(r.count)
    }));

    // 5. CARTE THERMIQUE
    const heatRes = await db.query(`
        SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
        FROM meetings
        WHERE start_time >= ${dateFilter} AND deleted_at IS NULL
        GROUP BY hour
    `);
    const heatmap = {};
    heatRes.rows.forEach(r => {
        heatmap[parseInt(r.hour)] = parseInt(r.count);
    });

    // 6. TOTAUX (pour stats_global.html et dash)
    const meetingsCount = await db.query('SELECT COUNT(*) FROM meetings WHERE deleted_at IS NULL');
    const participantsCount = await db.query('SELECT COUNT(*) FROM attendees');
    const usersCount = await db.query('SELECT COUNT(*) FROM users WHERE role = \'user\' AND deleted_at IS NULL');
    const coordinationsCount = await db.query('SELECT COUNT(*) FROM coordinations');

    const totalMeetings = parseInt(meetingsCount.rows[0].count);
    const totalAttendees = parseInt(participantsCount.rows[0].count);
    const participationRate = totalMeetings > 0 ? (totalAttendees / totalMeetings).toFixed(1) : "0.0";

    return {
        totalHours,
        devices,
        logs,
        trends,
        radar,
        heatmap,
        meetings: totalMeetings,
        participants: totalAttendees,
        users: parseInt(usersCount.rows[0].count),
        coordinations: parseInt(coordinationsCount.rows[0].count),
        participationRate
    };
}

app.get('/api/stats/global', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const period = req.query.period || '7d';
        const data = await fetchGlobalStats(period);
        res.json(data);
    } catch (err) {
        console.error("Erreur de statistiques globales :", err);
        res.status(500).json({ error: err.message });
    }
});

// Route de rapport PDF
app.get('/api/reports/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const period = req.query.period || '7d';
        const stats = await fetchGlobalStats(period);

        let dateFilter = "NOW() - INTERVAL '7 days'";
        if (period === '1m') dateFilter = "NOW() - INTERVAL '30 days'";
        if (period === '1y') dateFilter = "NOW() - INTERVAL '1 year'";
        if (period === '30d') dateFilter = "NOW() - INTERVAL '30 days'";
        if (period === '90d') dateFilter = "NOW() - INTERVAL '90 days'";

        const resultModifs = await db.query(`
            SELECT 
                m.id, 
                m.title as meeting_name, 
                m.nombre_modifications,
                hm.date_modification,
                u.full_name
            FROM meetings m
            LEFT JOIN (
                SELECT reunion_id, MAX(date_modification) as max_date 
                FROM historique_modifications_reunions 
                GROUP BY reunion_id
            ) latest_mod ON m.id = latest_mod.reunion_id
            LEFT JOIN historique_modifications_reunions hm ON m.id = hm.reunion_id AND hm.date_modification = latest_mod.max_date
            LEFT JOIN users u ON hm.utilisateur_id = u.id
            WHERE m.start_time >= ${dateFilter} AND m.deleted_at IS NULL
        `);

        const intactMeetings = [];
        const modifiedMeetings = [];

        resultModifs.rows.forEach(r => {
            if (!r.nombre_modifications || parseInt(r.nombre_modifications) === 0) {
                intactMeetings.push(r.meeting_name);
            } else {
                modifiedMeetings.push({
                    title: r.meeting_name,
                    times_modified: parseInt(r.nombre_modifications),
                    user: (r.full_name || 'Inconnu').trim(),
                    date_modification: r.date_modification
                });
            }
        });

        stats.modificationsData = { intactMeetings, modifiedMeetings };

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=rapport_stats_${period}.pdf`);

        generateStatsPDF(stats, res);

    } catch (err) {
        console.error("Erreur de génération de PDF :", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Erreur lors de la génération du PDF" });
        }
    }
});

app.get('/api/stats/overview', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const userRole = req.session.user.role;
        const userId = req.session.user.id;
        const coordId = req.session.user.coordination_id;
        const { period, startDate, endDate } = req.query;

        let dateClause = '';
        let dateParams = [];
        if (startDate && endDate) {
            const finalEndDate = endDate.includes(' ') ? endDate : `${endDate} 23:59:59`;
            dateClause = ` AND created_at BETWEEN $1 AND $2`;
            dateParams = [startDate, finalEndDate];
        } else if (period === 'today') {
            dateClause = " AND created_at >= CURRENT_DATE";
        } else if (period === '7d') {
            dateClause = " AND created_at >= NOW() - INTERVAL '7 days'";
        } else if (period === '30d') {
            dateClause = " AND created_at >= NOW() - INTERVAL '30 days'";
        }

        // 1. Meetings Query
        let meetingFilter = `WHERE m.deleted_at IS NULL${dateClause.replace('created_at', 'm.created_at')}`;
        let paramsMeetings = [...dateParams];
        if (userRole === 'admin') {
            meetingFilter += ` AND (m.user_id = $${paramsMeetings.length + 1} OR m.coordination_id = $${paramsMeetings.length + 2})`;
            paramsMeetings.push(userId, coordId);
        } else if (userRole !== 'super_admin') {
            meetingFilter += ` AND m.user_id = $${paramsMeetings.length + 1}`;
            paramsMeetings.push(userId);
        }

        const meetingsCount = await db.query(`SELECT COUNT(*) FROM meetings m ${meetingFilter}`, paramsMeetings);
        const activeMeetings = await db.query(`SELECT COUNT(*) FROM meetings m ${meetingFilter} AND m.start_time <= NOW() AND (m.end_time IS NULL OR m.end_time >= NOW())`, paramsMeetings);

        // 2. Attendees Query
        let attendeeFilter = `JOIN meetings m ON a.meeting_id = m.id WHERE m.deleted_at IS NULL${dateClause.replace('created_at', 'm.created_at')}`;
        let paramsAttendees = [...dateParams];
        if (userRole === 'admin') {
            attendeeFilter += ` AND (m.user_id = $${paramsAttendees.length + 1} OR m.coordination_id = $${paramsAttendees.length + 2})`;
            paramsAttendees.push(userId, coordId);
        } else if (userRole !== 'super_admin') {
            attendeeFilter += ` AND m.user_id = $${paramsAttendees.length + 1}`;
            paramsAttendees.push(userId);
        }
        const attendeesCount = await db.query(`SELECT COUNT(*) FROM attendees a ${attendeeFilter}`, paramsAttendees);

        // 3. Members Query
        let memberFilter = "WHERE role = 'user' AND deleted_at IS NULL";
        let paramsMembers = [];
        if (userRole === 'admin') {
            memberFilter += ` AND coordination_id = $1`;
            paramsMembers = [coordId];
        } else if (userRole !== 'super_admin') {
            memberFilter += ` AND id = $1`;
            paramsMembers = [userId];
        }
        const usersCount = await db.query(`SELECT COUNT(*) FROM users ${memberFilter}`, paramsMembers);

        res.json({
            totalMeetings: parseInt(meetingsCount.rows[0].count),
            activeMeetings: parseInt(activeMeetings.rows[0].count),
            totalAttendees: parseInt(attendeesCount.rows[0].count),
            totalSupervisors: parseInt(usersCount.rows[0].count)
        });
    } catch (err) {
        console.error("Erreur /api/stats/overview:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/meetings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const filter = req.query.filter || '7d';
        let dateFilter = "NOW() - INTERVAL '7 days'";
        if (filter === '30d') dateFilter = "NOW() - INTERVAL '30 days'";
        if (filter === '90d') dateFilter = "NOW() - INTERVAL '90 days'";
        if (filter === '1y') dateFilter = "NOW() - INTERVAL '1 year'";

        const result = await db.query(`
            SELECT 
                DATE(start_time) as date,
                COUNT(*) as count
            FROM meetings
            WHERE start_time >= ${dateFilter} AND deleted_at IS NULL
            GROUP BY DATE(start_time)
            ORDER BY date ASC
        `);

        const labels = result.rows.map(row => new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        const data = result.rows.map(row => parseInt(row.count));

        res.json({ labels, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/modifications', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                DATE(date_modification) as date,
                COUNT(*) as count
            FROM historique_modifications_reunions
            WHERE date_modification >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(date_modification)
            ORDER BY date ASC
        `);

        // S'assurer de toujours générer un tableau des 7 derniers jours s'il n'y a pas assez de données
        if (result.rows.length === 0) {
            const labels = [];
            const data = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
                data.push(0);
            }
            return res.json({ labels, data });
        }

        const labels = result.rows.map(row => new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        const data = result.rows.map(row => parseInt(row.count));

        res.json({ labels, data });
    } catch (err) {
        console.error("Erreur stats modifications :", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/modifications-rate', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN nombre_modifications > 0 THEN 1 ELSE 0 END) as modified
            FROM meetings
            WHERE deleted_at IS NULL
        `);
        
        const total = parseInt(result.rows[0].total) || 0;
        const modified = parseInt(result.rows[0].modified) || 0;
        const unmodified = total - modified;
        
        res.json({
            labels: ['Modifiées', 'Intactes'],
            data: [modified, unmodified]
        });
    } catch (err) {
        console.error("Erreur stats modifications-rate :", err);
        res.status(500).json({ error: err.message });
    }
});

// NOUVEAU : Liste des réunions récentes pour la liste déroulante
app.get('/api/meetings/list', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const userRole = req.session.user.role;

        let query = `
            SELECT m.id, m.title, m.start_time 
            FROM meetings m
            WHERE m.deleted_at IS NULL
        `;
        const params = [];

        // Si l'utilisateur n'est pas admin, il ne voit que SES réunions
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            query += ` AND m.user_id = $1`;
            params.push(userId);
        }

        query += ` ORDER BY m.start_time DESC LIMIT 50`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOUVEAU : Liste détaillée des participants avec filtrage
app.get('/api/participants', isAuthenticated, async (req, res) => {
    try {
        const { filter, meetingId } = req.query;
        let query = `
            SELECT 
                a.id,
                a.nom, 
                a.prenom, 
                a.email, 
                a.created_at as date_inscription, 
                a.structure,
                a.fonction,
                a.signature,
                m.title as meeting_title,
                m.start_time as meeting_date
            FROM attendees a
            JOIN meetings m ON a.meeting_id = m.id
            WHERE m.deleted_at IS NULL
        `;
        const params = [];
        const userRole = req.session.user.role;
        const userId = req.session.user.id;
        const coordId = req.session.user.coordination_id;

        if (userRole === 'admin') {
            query += ` AND (m.user_id = $1 OR m.coordination_id = $2)`;
            params.push(userId, coordId);
        } else if (userRole !== 'super_admin') {
            query += ` AND m.user_id = $1`;
            params.push(userId);
        }

        const pCount = params.length;

        if (filter === 'week') {
            query += ` AND a.created_at >= NOW() - INTERVAL '7 days'`;
        } else if (filter === 'month') {
            query += ` AND a.created_at >= NOW() - INTERVAL '30 days'`;
        } else if (filter === 'meeting' && meetingId) {
            query += ` AND m.id = $${pCount + 1}`;
            params.push(meetingId);
        }

        query += ` ORDER BY a.created_at DESC`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur participants:", err);
        res.status(500).json({ error: err.message });
    }
});



app.get('/api/stats/participation/admin', isAuthenticated, async (req, res) => {
    try {
        const period = req.query.period || 'week';
        let dateFilter = "NOW() - INTERVAL '7 days'";
        let groupBy = "DATE(m.start_time)";
        let labelFormat = { day: 'numeric', month: 'short' };

        if (period === 'month') {
            dateFilter = "NOW() - INTERVAL '30 days'";
        } else if (period === 'quarter') {
            dateFilter = "NOW() - INTERVAL '90 days'";
            groupBy = "DATE_TRUNC('week', m.start_time)";
        } else if (period === 'year') {
            dateFilter = "NOW() - INTERVAL '1 year'";
            groupBy = "DATE_TRUNC('month', m.start_time)";
            labelFormat = { month: 'short', year: 'numeric' };
        }

        const result = await db.query(`
            SELECT 
                ${groupBy} as period,
                COUNT(DISTINCT m.id) as meetings,
                COUNT(a.id) as attendees
            FROM meetings m
            LEFT JOIN attendees a ON m.id = a.meeting_id
            WHERE m.start_time >= ${dateFilter} AND m.deleted_at IS NULL
            GROUP BY period
            ORDER BY period ASC
        `);

        let totalMeetings = 0;
        let totalAttendees = 0;

        const labels = result.rows.map(row => {
            const mCount = parseInt(row.meetings);
            const aCount = parseInt(row.attendees);
            totalMeetings += mCount;
            totalAttendees += aCount;

            const date = new Date(row.period);
            return date.toLocaleDateString('fr-FR', labelFormat);
        });

        const meetings = result.rows.map(row => parseInt(row.meetings));
        const attendees = result.rows.map(row => parseInt(row.attendees));

        const attendanceRate = totalMeetings > 0 ? (totalAttendees / totalMeetings).toFixed(1) : "0.0";

        res.json({ labels, meetings, attendees, attendanceRate });
    } catch (err) {
        console.error("Erreur stats participation:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/typology', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const filter = req.query.filter || '7d';
        let dateFilter = "NOW() - INTERVAL '7 days'";
        if (filter === '30d') dateFilter = "NOW() - INTERVAL '30 days'";
        if (filter === '90d') dateFilter = "NOW() - INTERVAL '90 days'";
        if (filter === '1y') dateFilter = "NOW() - INTERVAL '1 year'";

        const result = await db.query(`
            SELECT 
                c.name as coordination,
                COUNT(m.id) as count
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.start_time >= ${dateFilter} AND m.deleted_at IS NULL
            GROUP BY c.id, c.name
            ORDER BY count DESC
        `);

        const labels = result.rows.map(row => row.coordination || 'Sans coordination');
        const data = result.rows.map(row => parseInt(row.count));

        res.json({ labels, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Nouveau point de terminaison pour les principales coordinations
app.get('/api/stats/coordination-tops', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // 0. Total de TOUTES les réunions (y compris sans coordination)
        const totalMeetingsRes = await db.query('SELECT COUNT(*) as count FROM meetings WHERE deleted_at IS NULL');
        const totalMeetingsAll = parseInt(totalMeetingsRes.rows[0].count);

        // Le plus de réunions (Toutes périodes ou 30 j selon besoin, gardons 30j pour le "Top")
        const mostMeetingsRes = await db.query(`
            SELECT c.name, COUNT(m.id) as count
            FROM meetings m
            JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.start_time >= NOW() - INTERVAL '30 days' AND m.deleted_at IS NULL
            GROUP BY c.name
            ORDER BY count DESC
            LIMIT 1
        `);

        const mostMeetings = mostMeetingsRes.rows[0] ? {
            name: mostMeetingsRes.rows[0].name,
            count: parseInt(mostMeetingsRes.rows[0].count)
        } : null;

        // Meilleure participation réelle
        const bestAttendanceRes = await db.query(`
            SELECT c.name, COUNT(a.id) as count
            FROM meetings m
            JOIN coordinations c ON m.coordination_id = c.id
            JOIN attendees a ON m.id = a.meeting_id
            WHERE m.start_time >= NOW() - INTERVAL '30 days' AND m.deleted_at IS NULL
            GROUP BY c.name
            ORDER BY count DESC
            LIMIT 1
        `);

        const bestAttendance = bestAttendanceRes.rows[0] ? {
            name: bestAttendanceRes.rows[0].name,
            rate: parseInt(bestAttendanceRes.rows[0].count) + " Pres."
        } : null;

        res.json({
            totalMeetingsAll,
            mostMeetings,
            bestAttendance
        });

    } catch (err) {
        console.error("Erreur des principales coordinations :", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/heatmap', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const filter = req.query.filter || '7d';
        let dateFilter = "NOW() - INTERVAL '7 days'";
        if (filter === '30d') dateFilter = "NOW() - INTERVAL '30 days'";

        const result = await db.query(`
            SELECT 
                EXTRACT(HOUR FROM start_time) as hour,
                COUNT(*) as count
            FROM meetings
            WHERE start_time >= ${dateFilter} AND deleted_at IS NULL
            GROUP BY hour
            ORDER BY hour ASC
        `);

        const data = Array(24).fill(0);
        result.rows.forEach(row => {
            data[parseInt(row.hour)] = parseInt(row.count);
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/devices', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const filter = req.query.filter || '7d';
        let dateFilter = "NOW() - INTERVAL '7 days'";
        if (filter === '30d') dateFilter = "NOW() - INTERVAL '30 days'";

        const result = await db.query(`
            SELECT 
                device_type,
                COUNT(*) as count
            FROM login_logs
            WHERE created_at >= ${dateFilter}
            GROUP BY device_type
        `);

        const labels = result.rows.map(row => row.device_type === 'mobile' ? 'Mobile' : 'Desktop');
        const data = result.rows.map(row => parseInt(row.count));

        res.json({ labels, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/meeting-types', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const filter = req.query.filter || '7d';
        let dateFilter = "NOW() - INTERVAL '7 days'";
        if (filter === '30d') dateFilter = "NOW() - INTERVAL '30 days'";
        if (filter === '90d') dateFilter = "NOW() - INTERVAL '90 days'";
        if (filter === '1y') dateFilter = "NOW() - INTERVAL '1 year'";

        const result = await db.query(`
            SELECT 
                meeting_type,
                COUNT(*) as count
            FROM meetings
            WHERE start_time >= ${dateFilter} AND deleted_at IS NULL
            GROUP BY meeting_type
        `);

        // Mapping de tous les types possibles
        const typeCounts = {
            'intra': 0,
            'inter': 0,
            'ccms': 0,
            'externe': 0,
            'codir': 0
        };

        result.rows.forEach(row => {
            const t = (row.meeting_type || 'intra').toLowerCase();
            if (typeCounts[t] !== undefined) {
                typeCounts[t] = parseInt(row.count);
            }
        });

        res.json({
            labels: ['Intra', 'Inter', 'CCMS', 'Externe', 'CODIR'],
            data: [typeCounts.intra, typeCounts.inter, typeCounts.ccms, typeCounts.externe, typeCounts.codir]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats/intelligent-message', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const username = req.session.user.fullname || req.session.user.username || 'Administrateur';
        const role = req.session.user.role;

        // Determine correct greeting by time
        const hour = new Date().getHours();
        let greeting = "Bonjour";
        if (hour >= 18) greeting = "Bonsoir";

        // Query today's meetings
        let meetingQuery = `SELECT COUNT(*) FROM meetings WHERE DATE(start_time) = CURRENT_DATE AND deleted_at IS NULL`;
        let meetingParams = [];

        if (role !== 'super_admin' && role !== 'admin') {
            meetingQuery += ` AND user_id = $1`;
            meetingParams.push(userId);
        }

        const todayMeetingsRes = await db.query(meetingQuery, meetingParams);
        const todayMeetingsCount = parseInt(todayMeetingsRes.rows[0].count);

        // Query recent attendees (last 24h)
        let attendeeQuery = `
            SELECT COUNT(a.id) 
            FROM attendees a
            JOIN meetings m ON a.meeting_id = m.id
            WHERE a.created_at >= NOW() - INTERVAL '24 hours' AND m.deleted_at IS NULL
        `;
        let attendeeParams = [];

        if (role !== 'super_admin' && role !== 'admin') {
            attendeeQuery += ` AND m.user_id = $1`;
            attendeeParams.push(userId);
        }

        const recentAttendeesRes = await db.query(attendeeQuery, attendeeParams);
        const recentAttendeesCount = parseInt(recentAttendeesRes.rows[0].count);

        // Motivational quotes pool
        const quotes = [
            "Excellente journée de travail en perspective !",
            "Continuez votre excellent travail de gestion.",
            "L'organisation est la clé du succès, vous êtes sur la bonne voie !",
            "Gardez le cap, votre suivi garantit le bon déroulement des opérations.",
            "Une belle journée pour de nouvelles collaborations fructueuses."
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        // Construct message parts
        let messageHtml = `<strong>${greeting} ${username} ðŸ‘‹</strong><br>`;

        if (todayMeetingsCount > 0) {
            messageHtml += `Vous avez <span style="color:var(--primary); font-weight:bold;">${todayMeetingsCount} réunion(s)</span> prévue(s) aujourd'hui. `;
        } else {
            messageHtml += `Aucune réunion n'est planifiée pour vous aujourd'hui. `;
        }

        if (recentAttendeesCount > 0) {
            messageHtml += `Récemment, <span style="font-weight:bold;">${recentAttendeesCount} participant(s)</span> se sont enregistrés. `;
        }

        messageHtml += `<br><span style="font-style:italic; font-size:0.9em; display:inline-block; margin-top:5px; color:#555;">Â« ${randomQuote} Â»</span>`;

        res.json({ message: messageHtml });
    } catch (err) {
        console.error("Erreur message intelligent :", err);
        res.status(500).json({ error: err.message });
    }
});

// Génération de rapport PDF
// Génération de rapport PDF (Supprimé - doublon de /api/reports/stats)

// --- RÉCUPÉRATION DES DONNÉES COMPLÈTES D'UN PARTICIPANT CONNU ---
// Utilisé par le formulaire inter/intra pour pré-remplir les données si l'email est déjà dans la BD
app.get('/api/public/participant-info/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email requis.' });
        }

        // 1. Vérifier que la réunion existe
        const meetingRes = await db.query('SELECT id FROM meetings WHERE uuid = $1 AND deleted_at IS NULL', [uuid]);
        if (meetingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion introuvable.' });
        }
        const meetingId = meetingRes.rows[0].id;

        // 2. Vérifier si déjà inscrit à CETTE réunion spécifiquement
        const alreadyRes = await db.query(
            'SELECT id FROM attendees WHERE meeting_id = $1 AND email = $2',
            [meetingId, email]
        );
        const alreadyRegistered = alreadyRes.rows.length > 0;

        // 3. Chercher dans participants_uniques (email, nom_complet, departement=structure)
        const puRes = await db.query(
            'SELECT adresse_email, nom_complet, departement FROM participants_uniques WHERE adresse_email = $1',
            [email]
        );

        if (puRes.rows.length === 0) {
            // Email inconnu dans la BD → utilisateur doit remplir le formulaire complet
            return res.json({ found: false, alreadyRegistered });
        }

        const puData = puRes.rows[0];

        // 4. Récupérer la dernière participation connue pour avoir fonction et telephone
        const lastAttendeeRes = await db.query(`
            SELECT fonction, telephone, structure, nom, prenom
            FROM attendees
            WHERE email = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [email]);

        const lastAttendee = lastAttendeeRes.rows[0] || {};

        // 5. Décomposer nom_complet en prénom / nom
        const parts = (puData.nom_complet || '').trim().split(' ');
        const prenom = parts[0] || '';
        const nom = parts.slice(1).join(' ') || lastAttendee.nom || '';

        res.json({
            found: true,
            alreadyRegistered,
            participant: {
                email: puData.adresse_email,
                nom: lastAttendee.nom || nom,
                prenom: lastAttendee.prenom || prenom,
                nom_complet: puData.nom_complet,
                structure: lastAttendee.structure || puData.departement || '',
                fonction: lastAttendee.fonction || '',
                telephone: lastAttendee.telephone || ''
            }
        });

    } catch (err) {
        console.error('Erreur participant-info:', err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// --- VÉRIFICATION D'IDENTITÉ INTELLIGENTE (Étape 3) ---
app.post('/api/public/check-identity/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { email, fingerprint, gps } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (!email || !fingerprint) {
            return res.status(400).json({ error: 'Email et empreinte requis.' });
        }

        // 1. Détecter si déjà enregistré pour CETTE réunion
        const meetingRes = await db.query('SELECT id FROM meetings WHERE uuid = $1', [uuid]);
        if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Réunion introuvable.' });
        const meetingId = meetingRes.rows[0].id;

        const checkReg = await db.query('SELECT id FROM attendees WHERE meeting_id = $1 AND email = $2', [meetingId, email]);
        const alreadyRegistered = checkReg.rows.length > 0;

        // 2. Vérifier si le participant est connu (Bouclier OSEP)
        const participant = await serviceSecurite.obtenirParticipantParEmail(email);

        // 3. Vérifier le quota de l'appareil
        const nombreComptes = await serviceSecurite.compterComptesParEmpreinte(fingerprint);
        const quotaReached = nombreComptes >= 4;

        // 4. Scoring de confiance IA
        let score = 100;
        let decisionIA = 'AUTORISE';

        if (global.isEdrActive !== false) {
            score = await serviceSecurite.calculerScoreConfiance(email, fingerprint, ip, { gps, token: req.body.t, challenge_code: req.body.challenge_code }, meetingId);

            // Appliquer la sévérité dynamique du Bouclier EDR
            const severity = global.edrSeverity || 'NORMAL';
            if (severity === 'STRICT') {
                decisionIA = score >= 90 ? 'AUTORISE' : (score >= 50 ? 'CHALLENGE_AUTO' : 'BLOQUE');
            } else if (severity === 'FAIBLE') {
                decisionIA = score >= 40 ? 'AUTORISE' : (score >= 20 ? 'CHALLENGE_AUTO' : 'BLOQUE');
            } else { // NORMAL
                decisionIA = score >= 80 ? 'AUTORISE' : (score >= 40 ? 'CHALLENGE_AUTO' : 'BLOQUE');
            }
        }

        // 5. Journalisation SIEM de la vérification
        await serviceSecurite.loggerSIEM({
            reunionId: uuid,
            email,
            fingerprint,
            ip,
            action: 'CHECK_IDENTITY',
            score,
            metadonnees: { gps, nombreComptes },
            decision: decisionIA
        });

        // 6. Création d'une session SI identifié et autorisé (Pour bypasser le jeton QR tournant aux étapes suivantes)
        let sessionToken = null;
        if (participant && decisionIA !== 'BLOQUE' && !quotaReached) {
            // On a besoin de l'ID de l'appareil
            const vAppRes = await serviceSecurite.verifierOuEnregistrerAppareil(email, fingerprint, req.headers['user-agent']);
            if (vAppRes.succes) {
                sessionToken = await serviceSecurite.creerSession(email, vAppRes.appareil.id, uuid);
            }
        }

        res.json({
            status: 'success',
            participant: participant ? { nom_complet: participant.nom_complet, departement: participant.departement } : null,
            alreadyRegistered,
            quotaReached,
            decisionIA,
            nombreComptes,
            sessionToken
        });

    } catch (err) {
        console.error('Erreur check-identity:', err);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification.' });
    }
});

// --- PROCÉDURE DE DÉCHARGE / PURGE (Étape 3) ---
app.post('/api/public/discharge-purge/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { email, fingerprint } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (!email || !fingerprint) {
            return res.status(400).json({ error: 'Email et empreinte requis.' });
        }

        // 1. Purger les comptes
        const emailsSupprimes = await serviceSecurite.purgerComptesParEmpreinte(fingerprint);

        // 2. Journaliser l'action de décharge
        await serviceSecurite.loggerSIEM({
            reunionId: uuid,
            email,
            fingerprint,
            ip,
            action: 'QUOTA_PURGE_DISCHARGE',
            score: 100,
            metadonnees: { emailsSupprimes, date: new Date().toISOString() },
            decision: 'AUTORISE'
        });

        // 3. Réponse
        res.json({
            status: 'success',
            message: 'Compte purgés avec succès.',
            emailsSupprimes,
            downloadUrl: `/api/public/discharge-pdf?email=${encodeURIComponent(email)}&fp=${encodeURIComponent(fingerprint)}`
        });

    } catch (err) {
        console.error('Erreur discharge-purge:', err);
        res.status(500).json({ error: 'Erreur lors de la purge des comptes.' });
    }
});

// Route de téléchargement du PDF de décharge
app.get('/api/public/discharge-pdf', async (req, res) => {
    try {
        const { email, fp } = req.query;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (!email || !fp) return res.status(400).send('Paramètres manquants.');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Decharge_OSEP_${email.split('@')[0]}.pdf`);

        pdfGenerator.generateDischargePDF({ email, fingerprint: fp, ip }, res);

    } catch (err) {
        console.error('Erreur Download PDF:', err);
        res.status(500).send('Erreur lors de la génération du PDF.');
    }
});

// --- ACCÈS AUX JETONS QR DYNAMIQUES (Étape 4) ---
app.get('/api/meetings/:uuid/qr-token', isAuthenticated, async (req, res) => {
    try {
        const { uuid } = req.params;
        const token = serviceSecurite.genererTokenDynamique(uuid);
        res.json({ token, expires_in: 30 - (Math.floor(Date.now() / 1000) % 30) });
    } catch (err) {
        res.status(500).json({ error: 'Erreur génération jeton QR.' });
    }
});

// --- CODE DE DÉFI (CHALLENGE) ---
app.get('/api/meetings/:uuid/challenge-code', isAuthenticated, async (req, res) => {
    try {
        const { uuid } = req.params;
        const code = serviceSecurite.genererChallengeCode(uuid);
        res.json({ code, expires_in: 60 - (Math.floor(Date.now() / 1000) % 60) });
    } catch (err) {
        res.status(500).json({ error: 'Erreur génération code défi.' });
    }
});

// --- ACCÈS À LA VUE PROJECTION (LOBBY) ---
app.get('/lobby/:uuid', async (req, res) => {
    res.render('lobby-reunion.html');
});

// --- API PUBLIQUE POUR LES DONNÉES DU LOBBY (QR + Challenge) ---
app.get('/api/public/lobby-data/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const meetingRes = await db.query('SELECT id, title, end_time, token_refresh_interval FROM meetings WHERE uuid = $1', [uuid]);
        if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Réunion introuvable' });

        const meeting = meetingRes.rows[0];
        const isFinished = meeting.end_time ? new Date() > new Date(meeting.end_time) : false;
        const refreshInterval = meeting.token_refresh_interval || 30; // fallback to 30

        // Générer le token dynamique et l'URL du QR
        const token = serviceSecurite.genererTokenDynamique(uuid, refreshInterval);
        const meetingUrl = `${req.protocol}://${req.get('host')}/meeting/${uuid}?t=${token}`;
        const qrCode = await QRCode.toDataURL(meetingUrl);

        const challengeCode = serviceSecurite.genererChallengeCode(uuid, refreshInterval);

        res.json({
            title: meeting.title,
            qr_code: qrCode,
            challenge_code: challengeCode,
            isFinished: isFinished,
            refresh_interval: refreshInterval,
            expires_in_qr: refreshInterval - (Math.floor(Date.now() / 1000) % refreshInterval),
            expires_in_challenge: refreshInterval - (Math.floor(Date.now() / 1000) % refreshInterval)
        });
    } catch (err) {
        console.error('Lobby data error:', err);
        res.status(500).json({ error: 'Erreur serveur lobby' });
    }
});

// --- API SIEM (Déplacé dans routesSecurite.js) ---

// 6. ACCÈS À LA RÉUNION (Route publique pour les participants)

// --- SOUMISSION DE SIGNATURE ---
app.post('/api/submit/:uuid', edrMiddleware.verifierAcces, async (req, res) => {
    try {
        const { uuid } = req.params;
        const { nom, prenom, fonction, email, structure, telephone, signature, teamName, fingerprint, gps, metadonnees } = req.body;
        const { score, appareilId } = req.edr; // Données provenant du middleware EDR

        // 1. Obtenir l'ID de la réunion et l'ID de coordination
        const meetingRes = await db.query('SELECT id, coordination_id FROM meetings WHERE uuid = $1', [uuid]);
        if (meetingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion introuvable' });
        }
        const meetingId = meetingRes.rows[0].id;
        const coordId = meetingRes.rows[0].coordination_id || null;

        // 1.5 Vérifier si déjà enregistré pour cette réunion (Eviter doublons par email)
        const checkRes = await db.query(
            'SELECT id FROM attendees WHERE meeting_id = $1 AND email = $2',
            [meetingId, email]
        );
        if (checkRes.rows.length > 0) {
            return res.status(400).json({ error: 'Vous êtes déjà enregistré pour cette réunion.' });
        }

        // 1.8 Gestion de l'équipe (UPSERT)
        let teamId = null;
        if (teamName && teamName.trim() !== '' && coordId) {
            let teamRes = await db.query('SELECT id FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND coordination_id = $2', [teamName, coordId]);
            if (teamRes.rows.length === 0) {
                teamRes = await db.query('INSERT INTO teams (name, coordination_id) VALUES (TRIM($1), $2) RETURNING id', [teamName, coordId]);
            }
            teamId = teamRes.rows[0].id;
        }

        // === BOUCLIER OSEP / ZERO TRUST (Étape 2 finalisée) ===
        // Note : L'analyse IA et le logging SIEM initial ont été faits dans le middleware EDR.

        // 3. Gestion Identité Unique
        await serviceSecurite.enregistrerParticipant(email, `${prenom} ${nom}`, structure);

        // 4. Création de session Zero Trust
        const jetonSession = await serviceSecurite.creerSession(email, appareilId, uuid);

        // 5. Émargement sécurisé avec preuve d'intégrité
        const timestamp = new Date().toISOString();
        const preuveIntegrite = serviceSecurite.genererPreuveIntegrite(email, uuid, timestamp);

        await db.query(`
            INSERT INTO emargements_securises (reunion_id, adresse_email, empreinte_utilisee, preuve_integrite_hash, date_validation)
            VALUES ($1, $2, $3, $4, $5)
        `, [uuid, email, fingerprint, preuveIntegrite, timestamp]);

        // 6. Journalisation SIEM du succès final
        await serviceSecurite.loggerSIEM({
            reunionId: uuid,
            email,
            fingerprint,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            action: 'INSCRIPTION_SUCCES',
            score,
            metadonnees: { ...metadonnees, gps },
            decision: 'AUTORISE'
        });

        // === FIN BOUCLIER OSEP ===

        // 7. Insérer le participant avec Empreinte et Géolocalisation pour le SIEM Avancé
        const browser_fingerprint = fingerprint ? JSON.stringify({ visitorId: fingerprint, ...metadonnees }) : null;
        const latitude = gps ? gps.lat : null;
        const longitude = gps ? gps.lng : null;

        const resultAttendee = await db.query(`
            INSERT INTO attendees (meeting_id, nom, prenom, email, fonction, structure, telephone, signature, team_id, browser_fingerprint, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `, [meetingId, nom, prenom, email, fonction, structure, telephone, signature, teamId, browser_fingerprint, latitude, longitude]);

        // 8. Alerte SIEM Avancé (SSE)
        if (latitude && longitude) {
            const controleurSiemAvance = require('./controleurs/controleurSiemAvance');
            controleurSiemAvance.diffuserAlerteGeoreperage({
                userId: resultAttendee.rows[0].id,
                username: `${prenom} ${nom}`,
                role: 'participant',
                latitude,
                longitude,
                message: "Nouveau participant traçé"
            });
        }

        // Marquer dans la session
        if (req.session) {
            if (!req.session.registrations) req.session.registrations = {};
            req.session.registrations[uuid] = email;
            req.session.osep_session_token = jetonSession;
        }

        res.json({ message: 'Enregistrement réussi', session_token: jetonSession });
    } catch (err) {
        console.error('Erreur de soumission de signature :', err);
        res.status(500).json({ error: err.message });
    }
});

// La route /meeting/:uuid est désormais gérée par publicRoutes et meetingController.js (Architecture MVC)


// ÉTAPE 2 : Formulaire de détails (osep2.html)
app.get('/meeting/:uuid/details', async (req, res) => {
    const { uuid } = req.params;
    // Validation de base (optionnel : vérifier si la réunion existe/est active)
    res.sendFile(path.join(__dirname, 'public', 'osep2.html'));
});

// ÉTAPE 3 : Signature (osep3.html)
app.get('/meeting/:uuid/sign', async (req, res) => {
    const { uuid } = req.params;
    res.sendFile(path.join(__dirname, 'public', 'osep3.html'));
});

// API : Obtenir les participants pour la page Finance (Public)
app.get('/api/attendees/:uuid', async (req, res) => {
    const { uuid } = req.params;

    // A. Validation de l'entrée
    if (!uuid || uuid.length < 10) { // Vérification de base de la longueur, les UUID ont généralement 36 caractères
        return res.status(400).json({ error: 'UUID invalide' });
    }

    try {
        // B. Sécurité & Logique métier : Vérifier l'existence de la réunion
        const meetingRes = await db.query('SELECT id, end_time FROM meetings WHERE uuid = $1', [uuid]);

        if (meetingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion non trouvée' });
        }

        const meeting = meetingRes.rows[0];

        // C. Requête Base de Données (SQL) : Récupérer les participants avec des champs spécifiques
        const attendeesRes = await db.query(`
            SELECT 
                nom,
                prenom,
                email,
                created_at,
                structure,
                telephone,
                signature,
                fonction
            FROM attendees 
            WHERE meeting_id = $1 
            ORDER BY created_at ASC
                `, [meeting.id]);

        // D. Réponse
        res.json({
            meeting: {
                endTime: meeting.end_time
            },
            attendees: attendeesRes.rows
        });

    } catch (err) {
        console.error("Erreur de récupération des participants :", err);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

// API : Soumission finale


// API pour obtenir les détails de la réunion par UUID (pour le rendu côté client)
app.get('/api/meeting/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
        const result = await db.query(`
            SELECT 
                m.*,
                c.name as coordination_name,
                u.full_name as creator_name,
                u.username as creator_username
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.uuid = $1 AND m.deleted_at IS NULL
                `, [uuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion non trouvée' });
        }

        const meeting = result.rows[0];
        res.json(meeting);
    } catch (err) {
        console.error("Erreur récup réunion:", err);
        res.status(500).json({ error: err.message });
    }
});

// Point de terminaison de statut public pour l'interrogation de la salle d'attente (aucune authentification requise)
app.get('/api/public/meetings/:uuid/status', async (req, res) => {
    const { uuid } = req.params;

    // Validation du format UUID pour éviter les erreurs PostgreSQL (ex: osep.html)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
        return res.status(400).json({ error: 'Format UUID invalide' });
    }

    try {
        const result = await db.query(`
            SELECT m.*, c.name as coordination_name, u.theme_color as creator_theme
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.uuid = $1 AND m.deleted_at IS NULL
                `, [uuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion non trouvée' });
        }

        const meeting = result.rows[0];
        const now = new Date();
        const startTime = new Date(meeting.start_time);

        // Calculer la fenêtre d'anticipation
        const waitingRoomMinutes = meeting.waiting_room_minutes || 30;
        const waitingRoomStart = new Date(startTime.getTime() - waitingRoomMinutes * 60000);
        const endTime = meeting.end_time ? new Date(meeting.end_time) : null;

        // Déterminer si la réunion est terminée
        const isFinished = endTime && now > endTime;

        // Déterminer si l'utilisateur peut entrer (correspond à la logique /meeting/:uuid)
        const canEnter = !isFinished && (meeting.force_open === true || (now >= waitingRoomStart));

        res.json({
            title: meeting.title,
            startTime: meeting.start_time,
            endTime: meeting.end_time,
            canEnter: canEnter,
            isFinished: isFinished,
            forceOpen: meeting.force_open || false,
            activeGame: meeting.active_game || 'bubbles',
            theme: meeting.creator_theme || 'green', // Par défaut à green
            themeColor: meeting.theme_color_override || meeting.creator_theme || null,
            backgroundType: meeting.background_type || null,
            backgroundValue: meeting.background_value || null,
            coordinationName: meeting.coordination_name
        });
    } catch (err) {
        console.error("Erreur status réunion:", err);
        res.status(500).json({ error: err.message });
    }
});

// 7. RÉUNION ACTUELLE (pour le tableau de bord)

app.get('/api/meetings/current', isAuthenticated, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*, c.name as coordination_name
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.start_time <= NOW() 
            AND(m.end_time IS NULL OR m.end_time >= NOW())
            AND m.deleted_at IS NULL
            ORDER BY m.start_time DESC
            LIMIT 1
                `);

        if (result.rows.length === 0) {
            return res.json(null);
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtenir les réunions en cours (pour la carte de compte à rebours)
app.get('/api/meetings/running', isAuthenticated, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*, c.name as coordination_name
            FROM meetings m
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.start_time <= NOW() 
            AND(m.end_time IS NULL OR m.end_time >= NOW())
            AND m.deleted_at IS NULL
            ORDER BY m.start_time ASC
                `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtenir une seule réunion par ID
app.get('/api/meetings/:id', isAuthenticated, async (req, res) => {
    try {
        const meetingId = req.params.id;
        const result = await db.query(`
            SELECT 
                m.*,
                u.username as creator_name,
                u.full_name as creator_full_name,
                u.role as creator_role,
                c.name as coordination_name
            FROM meetings m
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN coordinations c ON m.coordination_id = c.id
            WHERE m.id = $1 AND m.deleted_at IS NULL
                `, [meetingId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erreur récup réunion:', err);
        res.status(500).json({ error: err.message });
    }
});

// 8. ÉLÉMENTS DE L'ORDRE DU JOUR

app.get('/api/agenda/:meeting_id', isAuthenticated, async (req, res) => {
    const { meeting_id } = req.params;
    try {
        const result = await db.query(
            'SELECT * FROM agenda_items WHERE meeting_id = $1 ORDER BY created_at ASC',
            [meeting_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agenda', isAuthenticated, async (req, res) => {
    const { meeting_id, title } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO agenda_items (meeting_id, title) VALUES ($1, $2) RETURNING *',
            [meeting_id, title]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/agenda/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM agenda_items WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. GÉNÉRATION DE CODE QR

app.get('/api/qr/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
        const meetingUrl = `${req.protocol}://${req.get('host')}/meeting/${uuid}`;
        const qrCodeDataUrl = await QRCode.toDataURL(meetingUrl);
        res.json({ qr_code: qrCodeDataUrl, meeting_url: meetingUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exportation PDF des présences
app.get('/api/reports/attendance/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtenir les infos de la réunion
        const meetingRes = await db.query('SELECT * FROM meetings WHERE id = $1', [id]);
        if (meetingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Réunion introuvable' });
        }
        const meeting = meetingRes.rows[0];

        // 2. Obtenir la liste des participants
        const attendeesRes = await db.query(`
            SELECT nom, prenom, structure, fonction, signature, email, telephone, created_at 
            FROM attendees 
            WHERE meeting_id = $1
            ORDER BY nom ASC, prenom ASC
        `, [id]);

        // 3. Générer le PDF
        res.setHeader('Content-Type', 'application/pdf');

        // Nom du fichier avec le titre de la réunion
        const dateStr = new Date(meeting.start_time).toLocaleDateString('fr-FR').replace(/\//g, '_');
        const safeTitle = meeting.title ? meeting.title.replace(/[^a-z0-9]/gi, '_') : id;
        res.setHeader('Content-Disposition', `attachment; filename="Emargement_${dateStr}_${safeTitle}.pdf"`);

        generateAttendancePDF(meeting, attendeesRes.rows, res);

    } catch (err) {
        console.error('Erreur PDF des présences :', err);
        res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
});

// 10. STATISTIQUES D'EFFICACITÉ (Interne)

app.get('/api/internal/efficiency', isAuthenticated, isAdmin, (req, res) => {
    const avgTime = requestStats.total > 0 ? (requestStats.sumTime / requestStats.total).toFixed(2) : 0;
    res.json({
        total: requestStats.total,
        errors: requestStats.errors,
        slow: requestStats.slow,
        avgResponseTime: avgTime + 'ms'
    });
});

// --- DÉMARRER LE SERVEUR ---
app.listen(PORT, () => {
    console.log(`Serveur OSEP démarré sur http://localhost:${PORT}`);
});
