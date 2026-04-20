/**
 * Script Participation - OSEP
 * Gère les filtres, le graphique et la liste des participants
 */

let participationChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. En-tête des informations utilisateur
    await loadUserProfile();

    // 2. Initialiser les composants de l'interface
    initChart();
    initFilters();

    // 3. Chargement initial (Défaut : Semaine)
    loadMeetingsList(); // remplit la liste déroulante
    fetchData(); // charge les données
});

async function loadUserProfile() {
    try {
        const res = await fetch('/api/user/me');
        if (res.ok) {
            const user = await res.json();
            const profileName = document.querySelector('.user-profile h4');
            if (profileName) profileName.textContent = user.fullname || user.username;

            const profileImg = document.querySelector('.user-profile img');
            if (profileImg) profileImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullname || user.username) + '&background=10b981&color=fff';

            const coordName = user.coordination_name || 'Aucune coordination';
            let roleName = 'Utilisateur';
            if (user.role === 'admin') roleName = 'Administrateur';
            if (user.role === 'super_admin') roleName = 'Super Administrateur';
            document.getElementById('userSubtitle').innerHTML = `<strong>${roleName}</strong> • ${coordName}`;
        }
    } catch (e) { console.error('Erreur de récupération de l’utilisateur', e); }
}

function initFilters() {
    const periodSelect = document.getElementById('filterPeriod');
    const meetingSelect = document.getElementById('filterMeeting');
    const applyBtn = document.getElementById('applyFilters');
    const exportBtn = document.getElementById('exportPDF');

    // Basculer la visibilité de la sélection de réunion
    periodSelect.addEventListener('change', () => {
        if (periodSelect.value === 'meeting') {
            meetingSelect.style.display = 'inline-block';
            exportBtn.style.display = 'inline-block';
        } else {
            meetingSelect.style.display = 'none';
            exportBtn.style.display = 'none';
        }
    });

    exportBtn.addEventListener('click', () => {
        const meetingId = meetingSelect.value;
        if (!meetingId) {
            alert("Veuillez d'abord sélectionner une réunion.");
            return;
        }
        // Appel de l'API backend pour générer le PDF officiel
        window.open('/api/reports/attendance/' + meetingId, '_blank');
    });

    applyBtn.addEventListener('click', () => {
        fetchData();
    });
}

async function loadMeetingsList() {
    try {
        const res = await fetch('/api/meetings/list');
        const list = await res.json();
        const select = document.getElementById('filterMeeting');

        select.innerHTML = '<option value="">-- Choisir une réunion --</option>';
        list.forEach(m => {
            const dateStr = new Date(m.start_time).toLocaleDateString('fr-FR');
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${dateStr} - ${m.title}`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Erreur chargement réunions", e);
    }
}

// --- RÉCUPÉRATION DES DONNÉES ---

async function fetchData() {
    const filter = document.getElementById('filterPeriod').value;
    const meetingId = document.getElementById('filterMeeting').value;

    const spinner = document.getElementById('loading-spinner');
    const noData = document.getElementById('no-data-message');
    const table = document.getElementById('participants-table');
    const tbody = document.getElementById('participants-body');

    // UI Loading State
    spinner.style.display = 'block';
    noData.style.display = 'none';
    table.style.display = 'none';
    tbody.innerHTML = '';

    try {
        // 1. Récupérer la liste des participants
        let url = `/api/participants?filter=${filter}`;
        if (filter === 'meeting' && meetingId) {
            url += `&meetingId=${meetingId}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        spinner.style.display = 'none';

        if (!data || data.length === 0) {
            noData.style.display = 'block';
        } else {
            table.style.display = 'table';
            data.forEach(p => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #eee';

                const dateObj = new Date(p.date_inscription);
                const dateStr = dateObj.toLocaleDateString('fr-FR') + ' ' + dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                // Injection sécurisée du texte
                tr.innerHTML = `
                    <td style="padding:12px; color:#555;">${dateStr}</td>
                    <td style="padding:12px; font-weight:600;"></td>
                    <td style="padding:12px; color:#666;"></td>
                    <td style="padding:12px; color:#666;"></td>
                    <td style="padding:12px; text-align:center;"></td>
                `;

                // Définir explicitement le contenu textuel pour prévenir les attaques XSS
                tr.children[1].textContent = `${p.nom || ''} ${p.prenom || ''}`;
                tr.children[2].textContent = `${p.fonction || '-'} / ${p.structure || '-'}`;
                tr.children[3].textContent = p.meeting_title || '-';

                // Gestion de la signature
                if (p.signature && p.signature.startsWith('data:image')) {
                    const img = document.createElement('img');
                    img.src = p.signature;
                    img.style.maxHeight = '40px';
                    img.style.maxWidth = '100px';
                    img.style.objectFit = 'contain';
                    tr.children[4].appendChild(img);
                } else {
                    tr.children[4].textContent = 'Non signé';
                    tr.children[4].style.color = '#999';
                    tr.children[4].style.fontStyle = 'italic';
                }

                tbody.appendChild(tr);
            });
        }

        // 2. Récupérer le top des participants (logique globale)
        fetchTopAttendees();

        // 3. Mettre à jour le graphique
        updateChartData(filter, meetingId);

    } catch (err) {
        console.error("Erreur fetch participation", err);
        spinner.style.display = 'none';
        noData.style.display = 'block';
    }
}

async function fetchTopAttendees() {
    try {
        const res = await fetch('/api/stats/top-attendees');
        const list = document.getElementById('topAttendees');
        list.innerHTML = '';

        if (res.ok) {
            const attendees = await res.json();
            if (attendees && attendees.length > 0) {
                attendees.forEach((a, index) => {
                    // Affichage du score d'assiduité (nombre de participations)
                    const label = a.count > 1 ? 'réunions' : 'réunion';
                    list.innerHTML += `<li><div class="item-icon green-bg">${index + 1}</div> ${a.prenom} ${a.nom} <span style="margin-left:auto; font-weight:700; color:var(--primary); font-size:0.8rem;">${a.count} ${label}</span></li>`;
                });
            } else {
                list.innerHTML = '<li>Aucun participant enregistré</li>';
            }
        }
    } catch (e) {
        console.error("Erreur chargement Top Assiduité", e);
    }
}

// --- LOGIQUE DU GRAPHIQUE ---

function initChart() {
    const ctx = document.getElementById('participationChart').getContext('2d');
    participationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Réunions',
                    data: [],
                    backgroundColor: '#0f3d2e',
                    borderRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: 'Participants',
                    data: [],
                    backgroundColor: '#22c55e',
                    borderRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true },
                y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
            }
        }
    });
}

async function updateChartData(filter, meetingId) {
    let periodParam = 'week';
    if (filter === 'month') periodParam = 'month';
    if (filter === 'meeting') periodParam = 'week'; 

    try {
        const res = await fetch(`/api/stats/participation?period=${periodParam}`);
        if (res.ok) {
            const data = await res.json();
            if (participationChart && data.labels) {
                participationChart.data.labels = data.labels;
                participationChart.data.datasets[0].data = data.meetings;
                participationChart.data.datasets[1].data = data.attendees;
                participationChart.update();
            }
        }
    } catch (e) { console.error(e); }
}
