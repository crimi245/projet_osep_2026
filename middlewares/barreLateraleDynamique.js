const sidebarElements = require('./elementsBarreLaterale');

// OPTIMISATION 1 : Pré-calcul en mémoire (S'exécute 1 fois au démarrage)
const menusByRole = {
    super_admin: sidebarElements.filter(link => link.roles.includes('super_admin')),
    admin: sidebarElements.filter(link => link.roles.includes('admin')),
    staff: sidebarElements.filter(link => link.roles.includes('staff')),
    user: sidebarElements.filter(link => link.roles.includes('user'))
};

const dynamicSidebar = (req, res, next) => {
    const userRole = req.session?.user?.role;

    // Si pas connecté ou rôle inconnu, on passe un tableau vide
    if (!userRole || !menusByRole[userRole]) {
        res.locals.sidebarLinks = [];
        res.locals.currentUser = null;
        return next();
    }

    const currentPath = req.originalUrl.split('?')[0]; // Ignorer les paramètres ?id=...

    // OPTIMISATION 2 : Logique "isActive" stricte pour éviter les conflits
    const formattedLinks = menusByRole[userRole].map(link => {
        const isExactMatch = currentPath === link.url;

        let isSubPathMatch = false;
        // Pour éviter que '/user/calendar' n'active '/user'
        if (link.url !== '/' && link.url !== '/user') {
            isSubPathMatch = currentPath.startsWith(link.url + '/');
        }

        const isActive = isExactMatch || isSubPathMatch;

        return {
            ...link,
            isActive: isActive,
            cssClass: isActive ? 'active' : ''
        };
    });

    // Injection dans EJS
    res.locals.sidebarLinks = formattedLinks;
    res.locals.sidebarFile = 'sidebar.html'; // Toujours utiliser le partial dynamique
    res.locals.currentUser = req.session.user || null;

    next();
};

module.exports = dynamicSidebar;
