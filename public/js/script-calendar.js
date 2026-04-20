/**
 * script-calendar.js
 * Gère l'affichage et les interactions du calendrier utilisateur.
 * Fetch API: /api/user/calendar-events
 */

let currentDate = new Date();
let events = [];

document.addEventListener('DOMContentLoaded', () => {
    initCalendar();

    // Écouteurs de navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });
});

async function initCalendar(retryCount = 0) {
    try {
        // Chargement des événements depuis l'API sécurisée
        const res = await fetch('/api/user/calendar-events');
        if (res.ok) {
            events = await res.json();
            renderCalendar();
        } else if (res.status === 429 && retryCount < 2) {
            // Trop de requêtes : attendre 3s et réessayer
            console.warn("Calendrier : trop de requêtes, nouvelle tentative dans 3s...");
            setTimeout(() => initCalendar(retryCount + 1), 3000);
        } else if (res.status === 429) {
            console.error("Erreur chargement calendrier (429 - trop de requêtes)");
            if (typeof showToast === 'function') showToast("Trop de requêtes. Veuillez patienter puis rafraîchir la page.", "error");
        } else {
            console.error("Erreur chargement calendrier");
            if (typeof showToast === 'function') showToast("Impossible de charger vos événements", "error");
        }
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast("Erreur réseau lors du chargement du calendrier", "error");
    }
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('monthDisplay');

    // Nettoyage grille (garder les en-têtes)
    const headers = grid.querySelectorAll('.day-name'); // Conserver les en-têtes
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));

    // Mettre à jour l'ordre du jour latéral (Side Agenda)
    if (typeof updateSideAgenda === 'function') updateSideAgenda();

    // Info Date
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    monthDisplay.innerText = `${monthNames[month]} ${year}`;

    // Calculs
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Ajustement jour semaine (Lundi=0 pour affichage mais JS Dimanche=0)
    // On veut Lundi en premier.
    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6; // Dimanche devient 6

    const prevLastDay = new Date(year, month, 0).getDate();

    // -- Jours Mois Précédent --
    for (let i = startDayIndex; i > 0; i--) {
        const dayNum = prevLastDay - i + 1;
        const cell = createCell(dayNum, true);
        grid.appendChild(cell);
    }

    // -- Jours Mois Courant --
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const cell = createCell(day, false, isToday);
        cell.style.cursor = 'pointer';
        cell.onclick = () => {
            window.location.href = `/new-meeting?date=${dateStr}`;
        };

        // Injecter événements
        const dayEvents = events.filter(e => e.start.startsWith(dateStr));
        dayEvents.forEach(evt => {
            const el = document.createElement('div');
            const priorityClass = `priority-${evt.priority || 'medium'}`;
            el.className = `event-item ${evt.type === 'inter' ? 'event-inter' : 'event-intra'} ${priorityClass}`;
            el.innerText = evt.title;
            el.title = evt.title; // Info-bulle simple
            el.onclick = (e) => {
                e.stopPropagation();
                openModal(evt);
            }
            cell.appendChild(el);
        });

        grid.appendChild(cell);
    }

    // -- Jours Mois Suivant --
    // Remplir jusqu'à ce que la grille soit complète (ex: 35 ou 42 cases total)
    // On calcule combien de cases on a ajouté
    const totalCells = startDayIndex + totalDays;
    const remaining = (totalCells > 35) ? 42 - totalCells : 35 - totalCells;

    for (let i = 1; i <= remaining; i++) {
        const cell = createCell(i, true);
        grid.appendChild(cell);
    }
}

function createCell(num, isOther, isToday) {
    const div = document.createElement('div');
    div.className = `day-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today' : ''}`;
    div.innerHTML = `<span class="day-num">${num}</span>`;
    return div;
}

// -- Modale --
function openModal(evt) {
    const modal = document.getElementById('eventModal');
    document.getElementById('modalTitle').innerText = evt.title;

    const start = new Date(evt.start);
    const end = evt.end ? new Date(evt.end) : null;

    const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

    document.getElementById('modalTime').innerText = `${start.toLocaleDateString()} • ${timeStr} - ${endTimeStr}`;
    document.getElementById('modalLocation').innerText = evt.location || 'Non spécifié';

    const badge = document.getElementById('modalTypeBadge');
    badge.innerText = evt.type === 'inter' ? 'Inter-coordination' : 'Intra-coordination';
    badge.className = `badge ${evt.type === 'inter' ? 'badge-orange' : 'badge-green'}`;

    // Affichage de la priorité dans la modale
    let priorityText = "Priorité : ";
    let priorityColor = "#f59e0b";
    if (evt.priority === 'low') { priorityText += "Basse"; priorityColor = "#10b981"; }
    else if (evt.priority === 'high') { priorityText += "Haute"; priorityColor = "#ef4444"; }
    else { priorityText += "Moyenne"; }

    const priorityEl = document.createElement('p');
    priorityEl.id = 'modalPriority';
    priorityEl.style = `margin-top: 8px; font-size: 0.85rem; font-weight: 600; color: ${priorityColor};`;
    priorityEl.innerHTML = `<i class="fa-solid fa-flag" style="width:20px;"></i> ${priorityText}`;

    // Nettoyer l'ancienne priorité si elle existe
    const oldP = document.getElementById('modalPriority');
    if (oldP) oldP.remove();
    document.getElementById('modalTypeContainer').after(priorityEl);

    document.getElementById('modalTypeContainer').style.display = 'block';

    // Lien
    const btnLink = document.getElementById('modalLink');
    if (evt.id) {
        btnLink.href = `/meeting/${evt.id}`; // Default fallback
        // Si l'event a un lien direct
        // btnLink.href = evt.link || ...
        btnLink.style.display = 'inline-flex';
    } else {
        btnLink.style.display = 'none';
    }

    modal.style.display = 'flex';
}

function updateSideAgenda() {
    const todayList = document.getElementById('todayAgendaList');
    const upcomingList = document.getElementById('upcomingAgendaList');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Filtrer pour aujourd'hui
    const todayEvents = events.filter(e => e.start.startsWith(todayStr))
        .sort((a, b) => new Date(a.start) - new Date(b.start));

    // Filtrer les événements à venir (les 5 prochains)
    const upcomingEvents = events.filter(e => new Date(e.start) > now && !e.start.startsWith(todayStr))
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .slice(0, 5);

    // Rendu pour aujourd'hui
    if (todayEvents.length > 0) {
        todayList.innerHTML = todayEvents.map(e => createAgendaItem(e)).join('');
    } else {
        todayList.innerHTML = '<p style="color:#999; font-size:0.9rem;">Aucune réunion aujourd\'hui.</p>';
    }

    // Rendu pour les événements à venir
    if (upcomingEvents.length > 0) {
        upcomingList.innerHTML = upcomingEvents.map(e => createAgendaItem(e)).join('');
    } else {
        upcomingList.innerHTML = '<p style="color:#999; font-size:0.9rem;">Rien de prévu prochainement.</p>';
    }
}

function createAgendaItem(e) {
    const date = new Date(e.start);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const priorityClass = `priority-${e.priority || 'medium'}`;
    return `
        <div class="agenda-item ${priorityClass}" onclick="openModal({title:'${e.title.replace(/'/g, "\\'")}', start:'${e.start}', end:'${e.end}', location:'${e.location || ''}', type:'${e.type}', id:'${e.id}', priority:'${e.priority}'})">
            <span class="time-badge">${dateStr} • ${timeStr}</span>
            <div style="font-weight:600; font-size:0.9rem;">${e.title}</div>
            <div style="font-size:0.8rem; color:#666; margin-top:2px;">${e.location || 'Distanciel'}</div>
        </div>
    `;
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
}

// Fermer au clic dehors
window.onclick = function (event) {
    const modal = document.getElementById('eventModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
}
