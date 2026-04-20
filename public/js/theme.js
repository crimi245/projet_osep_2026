(function () {
    // 1. Core Logic (Run Immediately)
    function applyTheme(theme) {
        // Cible <html> (documentElement) car le body n'existe pas encore lors de l'exécution dans le <head>
        const target = document.documentElement;

        if (theme === 'orange') {
            target.classList.add('theme-orange');
            target.classList.remove('theme-green');
        } else {
            // Par défaut = green
            target.classList.add('theme-green');
            target.classList.remove('theme-orange');
            if (theme === 'vert') theme = 'green';
        }
        localStorage.setItem('osep-theme', theme || 'green');

        // Notify others
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
    }

    // 2. Initial Load - DÉFAUT = GREEN
    const savedTheme = localStorage.getItem('osep-theme') || 'green';
    applyTheme(savedTheme);

    // 3. Toggle Logic (Global Scope) - INVERSÉ et ROBUSTE
    window.toggleTheme = function () {
        const current = localStorage.getItem('osep-theme') || 'green';
        // On considère 'green' et 'vert' comme identiques pour le basculement
        const isGreen = (current === 'green' || current === 'vert');
        const newTheme = isGreen ? 'orange' : 'green';
        applyTheme(newTheme);

        // Optionnel : Sauvegarder en BD si l'API existe (évite le retour au vert au prochain login)
        saveThemeToServer(newTheme);
    };

    async function saveThemeToServer(theme) {
        try {
            // Update SessionStorage Cache if exists to keep it consistent
            const cached = sessionStorage.getItem('osep_user_profile');
            if (cached) {
                const user = JSON.parse(cached);
                user.theme_color = theme;
                sessionStorage.setItem('osep_user_profile', JSON.stringify(user));
            }

            await fetch('/api/user/theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme })
            });
        } catch (e) { /* Silencieux si pas connecté */ }
    }

    // 4. UI Injection REMOVED based on user request
    // document.addEventListener('DOMContentLoaded', () => { ... });
})();
