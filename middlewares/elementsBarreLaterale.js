module.exports = [
    // --- ADMIN (Cabinet SP) ---
    { id: 'dashboard', label: 'Tableau de bord', url: '/dashboard', icon: 'fa-solid fa-table-cells-large', roles: ['admin'] },
    { id: 'stats_global', label: 'Statistiques Globales', url: '/stats', icon: 'fa-solid fa-chart-area', roles: ['admin'] },
    { id: 'participation', label: 'Participation', url: '/participation', icon: 'fa-solid fa-users-viewfinder', roles: ['admin'] },
    { id: 'calendar', label: 'Calendrier', url: '/calendar', icon: 'fa-regular fa-calendar', roles: ['admin'] },
    { id: 'new-meeting', label: 'Nouvelle Réunion', url: '/new-meeting', icon: 'fa-solid fa-plus-circle', roles: ['admin', 'user', 'staff'] },
    { id: 'links', label: 'Liens & QR', url: '/links', icon: 'fa-solid fa-link', roles: ['admin', 'staff', 'user'] },
    { id: 'experience', label: 'Gestion Expérience', url: '/experience', icon: 'fa-solid fa-wand-magic-sparkles', roles: ['admin', 'staff', 'user'] },

    // --- SUPER ADMIN ---
    { id: 'logs', label: 'SIEM / Journaux', url: '/logs', icon: 'fa-solid fa-shield-halved', roles: ['super_admin'] },
    { id: 'admin', label: 'Gestion Utilisateurs', url: '/admin', icon: 'fa-solid fa-users-gear', roles: ['super_admin'] },

    // --- COORDINATIONS (Admin only) ---
    {
        id: 'coordination',
        label: 'Coordinations',
        url: '/coordination',
        icon: 'fa-solid fa-user-group',
        roles: ['admin'],
        subItems: [
            { label: 'CSO', url: '/coordination?id=4' },
            { label: 'CEVS', url: '/coordination?id=5' },
            { label: 'CRHAJ', url: '/coordination?id=6' },
            { label: 'CCRPMR', url: '/coordination?id=7' },
            { label: 'CAITD', url: '/coordination?id=1' },
            { label: 'CGEN', url: '/coordination?id=8' },
            { label: 'CFPMG', url: '/coordination?id=9' },
            { label: 'SP', url: '/coordination?id=10' }
        ]
    },

    // --- STAFF (CFPMG) ---
    { id: 'vs_dashboard', label: 'Tableau de bord', url: '/dashboard-staff', icon: 'fa-solid fa-trophy', roles: ['staff'] },
    { id: 'staff_home', label: 'Rémunération', url: '/gestion-staff', icon: 'fa-solid fa-coins', roles: ['staff'] },
    { id: 'stats_staff', label: 'Statistiques Staff', url: '/stats-staff', icon: 'fa-solid fa-chart-line', roles: ['staff'] },
    { id: 'calendar_staff', label: 'Calendrier', url: '/user/calendar', icon: 'fa-regular fa-calendar', roles: ['staff'] },

    // --- USER ONLY ---
    { id: 'user_home', label: 'Mon Espace', url: '/user', icon: 'fa-solid fa-house-user', roles: ['user'] },
    { id: 'participation_ut', label: 'Mes Présences', url: '/participation_ut', icon: 'fa-solid fa-users-viewfinder', roles: ['user', 'staff'] },
    { id: 'calendar_ut', label: 'Calendrier', url: '/user/calendar', icon: 'fa-regular fa-calendar', roles: ['user'] },
    // empty line to keep indexes if needed, or just removed
];
