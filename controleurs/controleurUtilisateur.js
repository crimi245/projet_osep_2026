
const bcrypt = require('bcrypt');
const db = require('../config/db');
const logger = require('../utilitaires/journaliseur');

// GET /api/user/theme
exports.getTheme = (req, res) => {
    res.json({ theme: req.session.user.theme_color || 'green' });
};

// POST /api/user/theme
exports.updateTheme = async (req, res) => {
    const { theme } = req.body;
    if (!theme) return res.status(400).json({ error: 'Thème manquant' });

    try {
        await db.query('UPDATE users SET theme_color = $1 WHERE id = $2', [theme, req.session.user.id]);
        req.session.user.theme_color = theme;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/user/me
exports.getMe = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.full_name as fullname, u.role, u.gender, u.coordination_id, u.theme_color, c.name as coordination_name, c.sigle_coordination
            FROM users u
            LEFT JOIN coordinations c ON u.coordination_id = c.id
            WHERE u.id = $1 AND u.deleted_at IS NULL
        `, [req.session.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        await logger.error('ERREUR_UTILISATEUR_COURANT', req.session.user?.id || null, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/users (Admin only)
exports.createUser = async (req, res) => {
    const { username, password, role, fullname, coordination_id, gender } = req.body;

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO users (username, password_hash, role, full_name, coordination_id, gender) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [username, hash, role, fullname, coordination_id || null, gender || 'M']
        );
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') { // Clé dupliquée
            return res.status(400).json({ error: "Ce login (username) est déjà utilisé. Veuillez en choisir un autre." });
        }
        res.status(500).json({ error: err.message });
    }
};

// GET /api/users (Admin only)
exports.getAllUsers = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const result = await db.query('SELECT id, username, role, full_name, created_at, theme_color, coordination_id, is_active FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PUT /api/users/:id (Admin only)
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, full_name, role, password, coordination_id, is_active } = req.body;

        // Construire une requête de mise à jour dynamique
        let query = 'UPDATE users SET ';

        const params = [];
        const updates = [];
        let paramCounter = 1;

        if (username !== undefined) {
            updates.push(`username = $${paramCounter++}`);
            params.push(username);
        }
        if (full_name !== undefined) {
            updates.push(`full_name = $${paramCounter++}`);
            params.push(full_name);
        }
        if (role !== undefined) {
            updates.push(`role = $${paramCounter++}`);
            params.push(role);
        }
        if (coordination_id !== undefined) {
            updates.push(`coordination_id = $${paramCounter++}`);
            params.push(coordination_id || null);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCounter++}`);
            params.push(is_active);
        }
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramCounter++}`);
            params.push(hash);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
        }

        query += updates.join(', ');
        query += ` WHERE id = $${paramCounter} RETURNING id, username, role, full_name`;
        params.push(id);

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        try {
            await logger.info('UTILISATEUR_MIS_A_JOUR', req.session.user.id, {
                target_user_id: id,
                updated_fields: Object.keys(req.body)
            }, req);
        } catch (err) {
            console.error("Erreur du journaliseur (ignorée) :", err.message);
        }

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        try {
            await logger.error('ERREUR_MISE_A_JOUR_UTILISATEUR', req.session.user.id, { error: err.message }, req);
        } catch (e) { console.error("Échec du journaliseur dans le bloc catch :", e); }
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/users/:id (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteMeetings = req.query.deleteMeetings === 'true';

        // Empêcher la suppression de votre propre compte
        if (parseInt(id) === req.session.user.id) {
            return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
        }

        const result = await db.query(
            "UPDATE users SET deleted_at = CURRENT_TIMESTAMP, username = SUBSTRING(username FROM 1 FOR 70) || '_del_' || FLOOR(EXTRACT(EPOCH FROM NOW())) WHERE id = $1 AND deleted_at IS NULL RETURNING username",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé ou déjà supprimé' });
        }

        if (deleteMeetings) {
            await db.query("UPDATE meetings SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND deleted_at IS NULL", [id]);
            await logger.warn('SUPPRESSION_LOGIQUE_REUNIONS_UTILISATEUR', req.session.user.id, {
                deleted_user_id: id
            }, req);
        }

        await logger.warn('SUPPRESSION_LOGIQUE_UTILISATEUR', req.session.user.id, {
            deleted_user_id: id,
            deleted_username: result.rows[0].username,
            meetings_deleted: deleteMeetings
        }, req);

        res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
    } catch (err) {
        await logger.error('ERREUR_SUPPRESSION_UTILISATEUR', req.session.user.id, { error: err.message }, req);
        res.status(500).json({ error: err.message });
    }
};
