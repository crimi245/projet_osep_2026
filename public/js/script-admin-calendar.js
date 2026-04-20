/**
 * Logique du calendrier administrateur (Interface Tailwind)
 * Récupère les données depuis /api/users et /api/admin/calendar-events
 */

let originalUsers = [];
let meetings = [];
let currentDate = new Date();
let currentFilter = "all";
let selectedMeeting = null;

// Éléments du DOM
const calendarGrid = document.getElementById('calendarGrid');
const monthDisplay = document.getElementById('monthDisplay');
const mainTitle = document.getElementById('mainTitle');
const statToday = document.getElementById('statToday');
const userFilterList = document.getElementById('userFilterList');
const mainSubtitle = document.getElementById('mainSubtitle');

// Initialisation principale
async function initCalendar() {
    setupListeners();

    try {
        // Récupération parallèle pour la rapidité
        const [usersRes, meetingsRes] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/admin/calendar-events')
        ]);

        if (!usersRes.ok || !meetingsRes.ok) {
            throw new Error("Erreur de récupération des données API");
        }

        originalUsers = await usersRes.json();
        meetings = await meetingsRes.json();

        // Mappage des couleurs et initiales pour les utilisateurs
        originalUsers.forEach((u, index) => {
            const colors = ['#38bdf8', '#34d399', '#f87171', '#a78bfa', '#f59e0b', '#10b981'];
            u.color = u.theme_color || colors[index % colors.length];
            const names = (u.full_name || u.username).split(' ');
            if (names.length > 1) {
                u.initials = (names[0][0] + names[1][0]).toUpperCase();
            } else {
                u.initials = names[0].substring(0, 2).toUpperCase();
            }
        });

        setupFilters();
        setupCreatorSelect();
        updateStats();
        renderCalendar();

    } catch (error) {
        console.error("Admin Calendar Init Error:", error);
        calendarGrid.innerHTML = `<div style="grid-column: span 7; padding: 2rem; text-align: center; color: #ef4444;">
        Erreur de chargement: ${error.message}
    </div>`;
    }
}

function setupFilters() {
    userFilterList.innerHTML = '';

    // Élément "Tous"
    const allItem = document.createElement('div');
    allItem.className = 'user-item active';
    allItem.dataset.id = 'all';
    allItem.innerHTML = `
      <div class="user-avatar-small" style="background: linear-gradient(135deg, #94a3b8, #475569)">T</div>
      <div class="user-info"><div class="name">Tous les organisateurs</div></div>
    `;
    userFilterList.appendChild(allItem);

    // Lister les utilisateurs qui ont des réunions OU simplement tous les admins/superviseurs
    // Nous afficherons tous les utilisateurs renvoyés par /api/users
    originalUsers.forEach(u => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.dataset.id = u.id;
        item.innerHTML = `
        <div class="user-avatar-small" style="background: ${u.color}">${u.initials}</div>
        <div class="user-info">
            <div class="name">${u.full_name || u.username} ${(u.role === 'admin' || u.role === 'super_admin') ? '(Admin)' : ''}</div>
            <div class="role" style="font-size:0.75rem; color:var(--text-muted);">${u.role}</div>
        </div>
        `;
        userFilterList.appendChild(item);
    });
}

function setupCreatorSelect() {
    const select = document.getElementById('inputCreator');
    if (!select) return;

    select.innerHTML = '<option value="">Ouvrir pour sélectionner un organisateur</option>';
    originalUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.full_name || u.username} (${u.role})`;
        select.appendChild(opt);
    });
}

function updateStats() {
    // Format YYYY-MM-DD local
    const nowLocal = new Date();
    const todayStr = new Date(nowLocal.getTime() - (nowLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // Compter les correspondances exactes ou les chevauchements
    const count = meetings.filter(m => {
        const mStart = new Date(m.start).toISOString().split('T')[0];
        return mStart === todayStr;
    }).length;

    if (statToday) statToday.textContent = count;
}

// Logique de rendu
function renderCalendar() {
    if (!calendarGrid) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    if (mainTitle) mainTitle.textContent = monthNames[month] + " " + year;
    if (monthDisplay) monthDisplay.textContent = monthNames[month].substring(0, 3) + " " + year;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    calendarGrid.innerHTML = '';

    // Remplissage du mois précédent
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        const cell = createDayCell(prevLastDay - i, true);
        calendarGrid.appendChild(cell);
    }

    // Mois en cours
    const nowLocal = new Date();
    const todayStr = new Date(nowLocal.getTime() - (nowLocal.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const cell = createDayCell(day, false, isToday, dateStr);
        calendarGrid.appendChild(cell);
    }

    // Remplissage du mois suivant
    const remaining = 42 - calendarGrid.children.length;
    for (let i = 1; i <= remaining; i++) {
        const cell = createDayCell(i, true);
        calendarGrid.appendChild(cell);
    }
}

function createDayCell(dayNum, isOther, isToday = false, dateStr = null) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (isOther) cell.classList.add('other-month');
    if (isToday) cell.classList.add('today');

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `<span class="day-num">${dayNum}</span>`;
    cell.appendChild(header);

    if (dateStr) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-container';

        // Filtrer par date
        let dayMeetings = meetings.filter(m => {
            const mStart = new Date(m.start).toISOString().split('T')[0];
            return mStart === dateStr;
        });

        // Filtrer par utilisateur
        if (currentFilter !== 'all') {
            dayMeetings = dayMeetings.filter(m => String(m.organizer.id) === String(currentFilter));
        }

        dayMeetings.forEach(meet => {
            const tag = document.createElement('div');

            // Mapper les propriétés aux classes Tailwind comme demandé par l'utilisateur
            let colors = 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'; // Intra par défaut
            if (meet.priority === 'high') colors = 'bg-red-100 text-red-800 border-l-2 border-red-500';
            else if (meet.priority === 'low') colors = 'bg-green-100 text-green-800 border-l-2 border-green-500';
            else if (meet.type === 'inter' || meet.type === 'partenaire_externe') colors = 'bg-purple-100 text-purple-800 border-l-2 border-purple-500';

            tag.className = `event-tag ${colors} mb-1`;

            // Formater l'heure
            const timeStr = new Date(meet.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            tag.innerHTML = `<span class="tag-dot"></span> <span>${timeStr}</span> - ${meet.title}`;
            tag.onclick = () => openDetail(meet);
            eventsContainer.appendChild(tag);
        });

        cell.appendChild(eventsContainer);
    }

    return cell;
}

// Logique de la modale
function openDetail(meeting) {
    selectedMeeting = meeting;

    const body = document.getElementById('detailBody');
    const modal = document.getElementById('modalDetail');

    const timeStart = new Date(meeting.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const timeEnd = meeting.end ? new Date(meeting.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Fin non spécifiée';
    const dateStr = new Date(meeting.start).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let colors = 'bg-blue-100 text-blue-800 border-l-2 border-blue-500';
    if (meeting.priority === 'high') colors = 'bg-red-100 text-red-800 border-l-2 border-red-500';
    else if (meeting.priority === 'low') colors = 'bg-green-100 text-green-800 border-l-2 border-green-500';
    else if (meeting.type === 'inter') colors = 'bg-purple-100 text-purple-800 border-l-2 border-purple-500';

    body.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">${meeting.title}</h2>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span class="event-tag ${colors}" style="width: fit-content; padding: 4px 8px;">Type: ${meeting.type.toUpperCase()}</span>
        ${meeting.priority === 'high' ? '<span class="event-tag bg-red-100 text-red-800 border-l-2 border-red-500" style="width: fit-content; padding: 4px 8px;">Priorité Haute</span>' : ''}
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
      <div style="background: rgba(100,100,100,0.05); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color);">
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Date</div>
        <div style="font-weight: 600; text-transform: capitalize;">${dateStr}</div>
      </div>
      <div style="background: rgba(100,100,100,0.05); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color);">
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Horaires</div>
        <div style="font-weight: 600;">${timeStart} - ${timeEnd}</div>
      </div>
    </div>

    <div style="background: rgba(100,100,100,0.05); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Organisateur</div>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div class="user-avatar-small" style="background: ${meeting.organizer.color}; width: 36px; height: 36px; font-size: 0.85rem;">
          ${meeting.organizer.name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div style="font-weight: 600;">${meeting.organizer.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">@${meeting.organizer.username}</div>
        </div>
      </div>
    </div>
  `;

    document.getElementById('openLinkBtn').onclick = () => {
        window.location.href = `/links`; // Redirige vers les liens de réunion où l'admin peut les gérer
    };

    modal.classList.add('show');
}

function closeDetail() {
    document.getElementById('modalDetail').classList.remove('show');
    selectedMeeting = null;
}

function openAdd() {
    const defaultDate = new Date();
    const localDate = new Date(defaultDate.getTime() - (defaultDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('inputDate').value = localDate;

    // Sélectionner automatiquement l'administrateur connecté si possible
    try {
        const userStr = sessionStorage.getItem('osep_user_profile');
        if (userStr) {
            const user = JSON.parse(userStr);
            const select = document.getElementById('inputCreator');
            if (select) {
                // Find option matching user.id
                const opt = Array.from(select.options).find(o => parseInt(o.value) === user.id);
                if (opt) opt.selected = true;
            }
        }
    } catch (e) { console.error("Impossible de définir l'utilisateur par défaut", e); }

    document.getElementById('modalAdd').classList.add('show');
}

function closeAdd() {
    document.getElementById('modalAdd').classList.remove('show');
}

// Écouteurs d'événements
function setupListeners() {
    document.getElementById('prevBtn')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('todayBtn')?.addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });

    // Filtres utilisant la délégation d'événements
    userFilterList?.addEventListener('click', (e) => {
        const item = e.target.closest('.user-item');
        if (item) {
            document.querySelectorAll('.user-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentFilter = item.dataset.id;

            if (currentFilter === 'all') {
                if (mainSubtitle) mainSubtitle.textContent = "Vue administrateur globale";
            } else {
                const u = originalUsers.find(user => String(user.id) === currentFilter);
                if (u && mainSubtitle) mainSubtitle.textContent = `Visualisation : ${u.full_name || u.username}`;
            }
            renderCalendar();
        }
    });

    document.getElementById('closeDetail')?.addEventListener('click', closeDetail);
    document.getElementById('closeDetailBtn')?.addEventListener('click', closeDetail);

    // Fermer la modale lors d'un clic à l'extérieur
    document.getElementById('modalDetail')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalDetail')) {
            closeDetail();
        }
    });

    document.getElementById('fabCreate')?.addEventListener('click', openAdd);
    document.getElementById('closeAdd')?.addEventListener('click', closeAdd);
    document.getElementById('cancelAdd')?.addEventListener('click', closeAdd);

    // Soumission du formulaire
    const formAdd = document.getElementById('formAdd');
    if (formAdd) {
        formAdd.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Mapper les entrées
            const title = document.getElementById('inputTitle').value;
            const date = document.getElementById('inputDate').value;
            const time = document.getElementById('inputTime').value;
            const location = document.getElementById('inputLocation').value;
            const selectColor = document.getElementById('inputType').value; // 'blue', 'green', 'red', 'purple'
            const creatorId = document.getElementById('inputCreator').value;

            // Calculer les heures de début/fin
            const startDateTime = new Date(`${date}T${time}:00`);
            // Donner une durée par défaut d'une heure puisque l'heure de fin n'est pas dans le formulaire original
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

            // Mapper la couleur choisie vers meeting_type et priority en fonction des besoins
            let meetingType = 'intra';
            let priority = 'medium';
            let themeColor = '#38bdf8'; // Bleu

            if (selectColor === 'green') {
                priority = 'low';
                themeColor = '#34d399';
            } else if (selectColor === 'red') {
                priority = 'high';
                themeColor = '#f87171';
            } else if (selectColor === 'purple') {
                meetingType = 'partenaire_externe';
                themeColor = '#a78bfa';
            }

            const payload = {
                title: title,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                location: location || null,
                meeting_type: meetingType,
                priority: priority,
                theme_color: themeColor,
                user_id: creatorId ? parseInt(creatorId) : null
            };

            try {
                const res = await fetch('/api/meetings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showToast('Réunion créée avec succès !', 'success');
                    closeAdd();

                    // Recharger les données sans rafraîchir la page
                    const btnHtml = formAdd.querySelector('button[type="submit"]').innerHTML;
                    formAdd.querySelector('button[type="submit"]').innerHTML = '...';

                    try {
                        const meetingsRes = await fetch('/api/admin/calendar-events');
                        meetings = await meetingsRes.json();
                        updateStats();
                        renderCalendar();
                    } finally {
                        formAdd.querySelector('button[type="submit"]').innerHTML = btnHtml;
                    }

                } else {
                    const err = await res.json();
                    showToast("Erreur API: " + (err.error || "Inconnue"), 'error');
                }
            } catch (err) {
                console.error("Submit Add", err);
                showToast("Erreur de connexion", "error");
            }
        });
    }
}

// Start
document.addEventListener('DOMContentLoaded', initCalendar);
