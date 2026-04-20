
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    // Si accès API, retourner 401. Si accès Page, rediriger vers Login.
    if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/auth')) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    res.redirect('/');
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'super_admin')) {
        return next();
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Accès refusé' });
    }
    res.redirect('/');
};

const isSuperAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'super_admin') {
        return next();
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Accès réservé au Super Administrateur' });
    }
    res.status(403).send('Accès refusé. Cette page est réservée au Super Administrateur.');
};

const isStaffOrAdmin = (req, res, next) => {
    if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'super_admin' || req.session.user.role === 'staff')) {
        return next();
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ error: 'Accès réservé au personnel gérant / Admin' });
    }
    res.redirect('/');
};

module.exports = { isAuthenticated, isAdmin, isSuperAdmin, isStaffOrAdmin };
