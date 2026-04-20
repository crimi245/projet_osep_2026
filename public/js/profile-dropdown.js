/**
 * Menu déroulant du profil et gestion de l'en-tête
 * Gère : Informations utilisateur, Avatar, Menu déroulant (Déconnexion, paramètres), Thème
 */

document.addEventListener('DOMContentLoaded', () => {
    initProfileDropdown();
});

function initProfileDropdown() {
    const userArea = document.querySelector('.user-area');
    if (!userArea) return;

    // Injecter le HTML du menu déroulant s'il n'est pas présent
    if (!document.getElementById('profileDropdown')) {
        const dropdownHtml = `
            <div id="profileDropdown" class="profile-dropdown" style="display: none; opacity: 0; transform: translateY(-10px);">
                <div class="dropdown-header">
                    <h4 id="ddName">Chargement...</h4>
                    <p id="ddRole">...</p>
                </div>
                <hr>
                <ul class="dropdown-menu">
                    <li onclick="toggleThemeGlobal()"><i class="fa-solid fa-palette"></i> Thème</li>
                    <li class="danger" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Déconnexion</li>
                </ul>
            </div>
            <style>
                .profile-dropdown {
                    position: fixed !important;
                    top: 60px !important;
                    right: 20px !important;
                    left: auto !important;
                    background: white;
                    width: 260px;
                    border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    padding: 0;
                    z-index: 10000;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    border: 1px solid rgba(0,0,0,0.05);
                }
                .profile-dropdown.active {
                    display: block !important;
                    opacity: 1 !important;
                    transform: translateY(0) !important;
                }
                .dropdown-header {
                  padding: 20px;
                  background: #f9fafb;
                  border-radius: 15px 15px 0 0;
                }
                .dropdown-header h4 { margin: 0; font-size: 1rem; color: #1f2937; }
                .dropdown-header p { margin: 5px 0 0; font-size: 0.8rem; color: #6b7280; }
                .dropdown-menu { list-style: none; padding: 10px; margin: 0; }
                .dropdown-menu li {
                    padding: 12px 15px;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #4b5563;
                    font-size: 0.9rem;
                    transition: background 0.2s;
                }
                .dropdown-menu li:hover { background: #f3f4f6; color: #111; }
                .dropdown-menu li.danger:hover { background: #fee2e2; color: #ef4444; }
                hr { border: none; border-top: 1px solid #e5e7eb; margin: 0; }
                
                /* Clic sur la zone utilisateur */
                .user-profile { cursor: pointer; user-select: none; }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', dropdownHtml);
    }

    // Écouteur d'événement pour le clic
    const profileBtn = document.querySelector('.user-profile');
    const dropdown = document.getElementById('profileDropdown');

    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Maintenir le menu déroulant fixe dans le coin supérieur droit
            dropdown.style.top = '60px';
            dropdown.style.right = '20px';
            dropdown.style.left = 'auto'; // S'assurer que 'left' n'interfère pas

            toggleDropdown();
        });
    }

    // Mettre à jour les infos utilisateur dans le menu déroulant lors de l'ouverture ou de l'initialisation
    updateDropdownInfo();

    // Fermer lors d'un clic à l'extérieur
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
            closeDropdown();
        }
    });
}

function toggleDropdown() {
    const dd = document.getElementById('profileDropdown');
    const isActive = dd.classList.contains('active');
    if (isActive) closeDropdown(); else openDropdown();
}

function openDropdown() {
    const dd = document.getElementById('profileDropdown');
    dd.style.display = 'block';
    // Petit délai pour permettre à display:block de s'appliquer avant la transition
    setTimeout(() => {
        dd.classList.add('active');
    }, 10);
}

function closeDropdown() {
    const dd = document.getElementById('profileDropdown');
    dd.classList.remove('active');
    setTimeout(() => {
        if (!dd.classList.contains('active')) dd.style.display = 'none';
    }, 300);
}

async function updateDropdownInfo() {
    try {
        let user = null;
        const cached = sessionStorage.getItem('osep_user_profile');

        if (cached) {
            user = JSON.parse(cached);
        } else {
            const res = await fetch('/api/user/me');
            if (res.ok) {
                user = await res.json();
                sessionStorage.setItem('osep_user_profile', JSON.stringify(user));
            }
        }

        if (user) {
            // Informations de l'en-tête
            const nameEl = document.getElementById('userFullName') || document.querySelector('.user-profile h4');
            if (nameEl) nameEl.textContent = user.fullname || user.username;

            const roleEl = document.getElementById('userRole');
            // Dans certaines pages, roleEl peut ne pas exister dans l'en-tête, mais existe dans le menu déroulant

            // Informations du menu déroulant
            const ddName = document.getElementById('ddName');
            if (ddName) ddName.textContent = user.fullname || user.username;

            const ddRole = document.getElementById('ddRole');
            if (ddRole) {
                let roleText = 'Utilisateur';
                if (user.role === 'admin') roleText = 'Administrateur';
                if (user.role === 'super_admin') roleText = 'Super Administrateur';
                ddRole.textContent = roleText + (user.coordination_name ? ` • ${user.coordination_name}` : '');
            }

            // Mettre à jour la barre latérale en fonction du rôle
            updateSidebarAccess(user.role);

            // Avatar
            // Logique : "AD" pour Admin, "US" pour User, ou Initiales
            // Condition : "le petit cercle réprésentant le compte de l'admin ou il y'a ecrit AD en haut à gauche est différent dans chaque page"
            // Nous l'unifions ici.

            let initials = "U";
            if (user.role === 'admin' || user.role === 'super_admin') initials = "AD";
            else {
                // Obtenir les initiales à partir du nom complet
                const names = (user.fullname || user.username).split(' ');
                initials = names[0][0].toUpperCase() + (names.length > 1 ? names[1][0].toUpperCase() : '');
            }

            // Chercher l'image de l'avatar ou en créer une
            const img = document.querySelector('.user-profile img');
            if (img) {
                // Utiliser UI Avatars avec les initiales
                img.src = `https://ui-avatars.com/api/?name=${initials}&background=0f3d2e&color=fff&size=128`;
            } else {
                // Si c'est un div/icône au lieu d'une image, remplacer ou contenu? 
                // Actuellement, la plupart des pages utilisent <img>. 
            }

        }
    } catch (e) {
        console.error("Erreur récupération utilisateur dropdown", e);
    }
}

function updateSidebarAccess(role) {
    // Éléments réservés aux administrateurs
    const adminItems = document.querySelectorAll('.menu-admin');

    if (role && role !== 'admin' && role !== 'super_admin') {
        adminItems.forEach(el => el.style.display = 'none');

        // Rediriger si sur une page admin
        const path = window.location.pathname;
        const isStaffPage = path.includes('-staff') || path.includes('/gestion-staff');
        const isUserCalendar = path === '/user/calendar' || path === '/participation_ut';

        if ((path.includes('/admin') || path.includes('/logs') || path.includes('/coordination') ||
            path.includes('/stats') || path.includes('/calendar') || path.includes('/participation')) && 
            !isStaffPage && !isUserCalendar) {
            
            console.warn("Unauthorized access, redirecting...");
            window.location.href = '/user';
        }
    }
}

async function logout() {
    try {
        // Effacer TOUTES les clés de session possibles pour éviter un état obsolète
        sessionStorage.removeItem('osep_user_profile');
        sessionStorage.removeItem('osepUser');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userTheme');

        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login?logout=success';
    } catch (e) {
        window.location.href = '/login';
    }
}

// Aide globale pour basculer le thème
async function toggleThemeGlobal() {
    // Vérifier le thème actuel depuis localStorage ou l'API? 
    // On bascule la classe sur le body et on envoie à l'API
    const isDark = document.body.classList.contains('dark-theme'); // Exemple si nous avions un thème sombre
    // En fait, l'utilisateur a des thèmes "Vert" ou "Orange" généralement via le chargement de fichiers CSS.
    // Supposons qu'on bascule entre Vert et Orange? 
    // Par défaut sur une alerte pour l'instant car les "Paramètres du thème" pourraient être complexes (sélecteurs de couleurs).
    // Ou réutilisation de la logique `public/js/theme.js` existante si elle existe.

    // Vérifier si `toggleTheme` existe?
    if (typeof toggleTheme === 'function') {
        toggleTheme();
    } else {
        toast.info("Changement de thème en cours...");
    }
}
