// utils.js

document.addEventListener('DOMContentLoaded', () => {
    // applyTheme(); // RETIRÉ : Conflit avec theme.js
    initSidebar();
});

// applyTheme retiré pour éviter les conditions de concurrence avec theme.js

function initSidebar() {
    // On suppose que la barre latérale a l'ID 'sidebar' ou la classe 'video-sidebar' et le logo l'ID 'logo'
    // Cela dépend de la structure de dash.html/etc.
    // Je dois vérifier dash.html pour être précis, mais je vais écrire un gestionnaire générique

    // Tentative de trouver les éléments communs
    const logo = document.querySelector('.logo-area') || document.querySelector('#logo') || document.querySelector('.logo');
    const sidebar = document.querySelector('.video-sidebar') || document.querySelector('aside') || document.querySelector('#sidebar');

    if (sidebar) {
        // Restaurer l'état
        const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            sidebar.classList.add('closed'); // Supporte les deux conventions
        }

        // Note : Le clic sur le logo est géré par onclick="toggleSidebar()" dans le HTML
        // Pas besoin d'ajouter d'écouteur d'événement ici pour éviter les conflits

        // Gérer le bouton d'ouverture s'il existe
        const openBtn = document.getElementById('openSidebarBtn');
        if (openBtn) {
            // S'assurer de l'état initial correct
            const isClosed = sidebar.classList.contains('collapsed') || sidebar.classList.contains('closed');
            openBtn.style.display = isClosed ? 'block' : 'none';

            openBtn.addEventListener('click', () => {
                sidebar.classList.remove('collapsed');
                sidebar.classList.remove('closed');
                localStorage.setItem('sidebar-collapsed', 'false');
                openBtn.style.display = 'none';
            });
        }
    }
}

// Fonction globale toggleSidebar pour les gestionnaires onclick
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar') || document.querySelector('aside') || document.querySelector('#sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        sidebar.classList.toggle('closed');

        const isClosed = sidebar.classList.contains('collapsed') || sidebar.classList.contains('closed');
        localStorage.setItem('sidebar-collapsed', isClosed);

        // Gérer la visibilité du bouton d'ouverture
        const openBtn = document.getElementById('openSidebarBtn');
        if (openBtn) {
            openBtn.style.display = isClosed ? 'block' : 'none';
        }

        // Fix Leaflet map rendering issues on sidebar toggle
        setTimeout(() => {
            if (typeof map !== 'undefined' && map.invalidateSize) {
                map.invalidateSize();
            }
            if (typeof pickerMap !== 'undefined' && pickerMap.invalidateSize) {
                pickerMap.invalidateSize();
            }
        }, 300); // 300ms matches typical CSS transition durations
    }
}

// Afficher une boîte de dialogue de confirmation (basée sur une Promise)
// Afficher une boîte de dialogue de confirmation (basée sur une Promise)
window.showConfirm = function (message, type = 'danger', options = {}) {
    return new Promise((resolve) => {
        // Créer l'overlay de la modale
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.backdropFilter = 'blur(2px)';

        // Créer le contenu de la modale
        const modal = document.createElement('div');
        modal.style.backgroundColor = 'white';
        modal.style.padding = '25px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        modal.style.maxWidth = '400px';
        modal.style.width = '90%';
        modal.style.textAlign = 'center';
        modal.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // Titre
        const title = document.createElement('h3');
        title.textContent = options.title || 'Confirmation';
        title.style.marginTop = '0';
        title.style.color = type === 'danger' ? '#dc2626' : '#333';
        title.style.fontSize = '1.2rem';

        // Message
        const msg = document.createElement('p');
        msg.textContent = message;
        msg.style.color = '#555';
        msg.style.margin = '15px 0 25px 0';
        msg.style.lineHeight = '1.5';

        // Conteneur des boutons
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.gap = '15px';

        // Bouton Annuler
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annuler';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.border = '1px solid #ddd';
        cancelBtn.style.backgroundColor = 'white';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.color = '#555';
        cancelBtn.style.fontWeight = '500';
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f9fafb';
        cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = 'white';
        cancelBtn.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => { if (document.body.contains(overlay)) document.body.removeChild(overlay); }, 200);
            resolve(false);
        };

        // Bouton Confirmer
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'Confirmer';
        confirmBtn.style.padding = '10px 20px';
        confirmBtn.style.border = 'none';
        confirmBtn.style.backgroundColor = type === 'danger' ? '#dc2626' : '#2563eb';
        confirmBtn.style.color = 'white';
        confirmBtn.style.borderRadius = '6px';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.fontWeight = '500';
        confirmBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        confirmBtn.onmouseover = () => confirmBtn.style.backgroundColor = type === 'danger' ? '#b91c1c' : '#1d4ed8';
        confirmBtn.onmouseout = () => confirmBtn.style.backgroundColor = type === 'danger' ? '#dc2626' : '#2563eb';
        confirmBtn.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => { if (document.body.contains(overlay)) document.body.removeChild(overlay); }, 200);
            resolve(true);
        };

        // Ajouter les éléments
        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(confirmBtn);
        modal.appendChild(title);
        modal.appendChild(msg);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Ajouter les Keyframes d'animation si elles n'existent pas
        if (!document.getElementById('modal-animations')) {
            const style = document.createElement('style');
            style.id = 'modal-animations';
            style.innerHTML = `
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.8); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    });
};
