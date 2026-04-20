/**
 * Logique du tableau de bord et sondage en temps réel
 */

let currentMeetingId = null;
let donutChartRef = null;
let barChartRef = null;
let pollingInterval = null;
let runningTimersInterval = null;
let qrRotationInterval = null;
let currentQRUuid = null;

// Mises à jour au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    // Init Graphiques
    initCharts();

    // Vérifier les paramètres de nouvelle réunion (Auto-affichage du QR)
    const urlParams = new URLSearchParams(window.location.search);
    const newUuid = urlParams.get('new_meeting_uuid');
    if (newUuid) {
        const title = urlParams.get('new_meeting_title') || 'Nouvelle Réunion';
        const link = urlParams.get('new_meeting_link') || '';
        showQR(newUuid, link, title);

        // Nettoyage des paramètres de l'URL
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    // Chargement initial
    fetchGlobalStats();
    fetchCurrentMeeting();
    fetchRunningMeetings();

    // Filtre de période
    const periodSelect = document.getElementById('dashboardPeriodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            fetchGlobalStats();
        });
    }

    // Démarrer le sondage
    startPolling();
});

// API Page Visibility pour mettre en pause le sondage
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPolling();
    } else {
        fetchGlobalStats();
        fetchCurrentMeeting();
        startPolling();
    }
});

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        fetchGlobalStats();
        fetchCurrentMeeting();
        fetchRunningMeetings(); // Sonder les réunions en cours
        // fetchParticipationStats(); // Graphique à barres supprimé
    }, 5000); // Intervalle de 5 secondes
}

function stopPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = null;
}

function initCharts() {
    const donutCtx = document.getElementById('donutChart');
    if (donutCtx) {
        donutChartRef = new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: ['Écoulé', 'Restant'],
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#22c55e', '#f3f4f6'],
                    borderWidth: 0,
                    cutout: '75%',
                    circumference: 180,
                    rotation: 270
                }]
            },
            options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }
        });
    }

    // barChart removed as per UI request
}

async function fetchGlobalStats() {
    try {
        const period = document.getElementById('dashboardPeriodSelect')?.value || 'all';
        const res = await fetch(`/api/stats/overview?period=${period}`);
        if (res.ok) {
            const stats = await res.json();
            updateText('statTotalMeetings', stats.totalMeetings || 0);
            updateText('statActiveMeetings', stats.activeMeetings || 0);
            updateText('statAttendees', stats.totalAttendees || 0);
            updateText('statSupervisors', stats.totalSupervisors || 0);
        }

        const coordRes = await fetch('/api/coordinations');
        if (coordRes.ok) {
            const coords = await coordRes.json();
            const list = document.getElementById('coordListMini');
            if (coords.length > 0) {
                list.innerHTML = '';
                coords.slice(0, 3).forEach(c => {
                    list.innerHTML += `<li><div style="flex:1;"><h4>${c.name}</h4><p style="font-size:0.7rem; color:#888;">${c.head_name || ''}</p></div><span class="badge badge-gray">Active</span></li>`;
                });
            } else {
                list.innerHTML = '<li>Aucune coordination</li>';
            }
        }
    } catch (e) { console.error(e); }
}

async function fetchCurrentMeeting() {
    try {
        const res = await fetch('/api/meetings/current');
        const meeting = await res.json();

        if (!meeting) {
            renderNoMeeting();
            return;
        }

        currentMeetingId = meeting.id;
        const statusBadge = document.getElementById('cmStatus');
        if (statusBadge) statusBadge.style.display = 'inline-block';
        renderMeeting(meeting);

    } catch (e) { console.error("Erreur réunion", e); }
}

function renderMeeting(m) {
    updateText('cmTitle', m.title);
    const start = new Date(m.start_time);
    const end = new Date(m.end_time);
    const now = new Date();

    const timeStr = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    updateText('cmTime', timeStr);

    // Informations mises à jour + Bouton QR
    const infoContainer = document.getElementById('cmInfo');
    if (infoContainer) {
        infoContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>Coordination: ${m.coordination_name || 'Non définie'} • Par: ${m.creator_name || '?'}</span>
                <button onclick="showQR('${m.uuid}', '${m.link || ''}', '${m.title}')" 
                        title="Afficher QR & Lien"
                        class="btn-light" style="padding:4px 10px; font-size:0.8rem; margin-left:10px;">
                    <i class="fa-solid fa-qrcode"></i> QR
                </button>
            </div>
        `;
    }

    const list = document.getElementById('cmAgendaList');
    if (list) {
        list.innerHTML = '';
        if (m.agenda && m.agenda.length > 0) {
            m.agenda.forEach(item => {
                const icon = item.status === 'done' ? '<i class="fa-solid fa-check-circle" style="color:#22c55e"></i>' : '<i class="fa-regular fa-circle"></i>';
                const style = item.status === 'done' ? 'text-decoration:line-through; opacity:0.6;' : '';
                list.innerHTML += `
                    <li onclick="toggleItem(${item.id})" style="cursor:pointer;">
                        <div class="item-icon" style="background:transparent; color:#333;">${icon}</div>
                        <div style="${style}">
                            <h4 style="margin:0;">${item.title}</h4>
                        </div>
                    </li>
                `;
            });
        } else {
            list.innerHTML = '<li style="color:#999; font-size:0.8rem;">Aucun point. Ajoutez-en un !</li>';
        }
    }

    const totalMs = end - start;
    const elapsedMs = now - start;
    const remainingMs = end - now;

    if (m.end_time && remainingMs > 0) {
        const h = Math.floor(remainingMs / (1000 * 60 * 60));
        const min = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((remainingMs % (1000 * 60)) / 1000);
        updateText('chronometer', `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    } else if (!m.end_time) {
        updateText('chronometer', "En cours");
    } else {
        updateText('chronometer', "00:00:00");
    }

    let pct = 0;
    if (totalMs > 0) pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    if (remainingMs < 0) pct = 100;

    updateText('donutPercent', Math.round(pct) + "%");
    if (donutChartRef) {
        donutChartRef.data.datasets[0].data = [pct, 100 - pct];
        donutChartRef.update();
    }
}

function renderNoMeeting() {
    currentMeetingId = null;
    updateText('cmTitle', "Aucune réunion active");
    updateText('cmTime', "En attente...");
    updateText('cmInfo', "");
    const statusBadge = document.getElementById('cmStatus');
    if (statusBadge) statusBadge.style.display = 'none';
    document.getElementById('cmAgendaList').innerHTML = "";
    updateText('chronometer', "--:--:--");
    updateText('donutPercent', "0%");
    if (donutChartRef) {
        donutChartRef.data.datasets[0].data = [0, 100];
        donutChartRef.update();
    }
}

// Aides
function updateText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// Interactions avec l'ordre du jour
function openAgendaModal() {
    if (!currentMeetingId) return toast.warning("Aucune réunion active pour ajouter un point.");
    document.getElementById('agendaModal').style.display = 'flex';
    document.getElementById('agendaInput').focus();
}

async function submitAgendaItem() {
    const val = document.getElementById('agendaInput').value;
    if (!val) return;
    try {
        await fetch(`/api/meetings/${currentMeetingId}/agenda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: val })
        });
        document.getElementById('agendaModal').style.display = 'none';
        document.getElementById('agendaInput').value = '';
        fetchCurrentMeeting();
    } catch (e) { toast.error("Erreur lors de l'ajout du point"); }
}

async function toggleItem(itemId) {
    try {
        await fetch(`/api/meetings/${currentMeetingId}/agenda/${itemId}/toggle`, { method: 'POST' });
        fetchCurrentMeeting();
    } catch (e) { }
}

// Fonctions de minuteur des réunions en cours
async function fetchRunningMeetings() {
    try {
        const res = await fetch('/api/meetings/running');
        if (res.ok) {
            const meetings = await res.json();
            renderRunningMeetings(meetings);
        }
    } catch (e) {
        console.error('Erreur lors de la récupération des réunions en cours:', e);
    }
}

function renderRunningMeetings(meetings) {
    const container = document.getElementById('runningMeetingsContainer');

    if (!meetings || meetings.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-style:italic; padding: 20px;">Aucune réunion en cours</p>';
        if (runningTimersInterval) {
            clearInterval(runningTimersInterval);
            runningTimersInterval = null;
        }
        return;
    }

    // Générer le HTML pour chaque réunion en cours
    container.innerHTML = meetings.map((m, index) => `
        <div class="running-meeting-item" style="border-bottom: 1px solid #f0f0f0; padding: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <h5 style="margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600;">${m.title}</h5>
                    <p style="margin: 0; font-size: 0.75rem; color: #666;">
                        <i class="fa-solid fa-sitemap" style="margin-right: 4px;"></i>${m.coordination_name || 'Générale'}
                    </p>
                </div>
                
                <button onclick="showQR('${m.uuid}', '${m.link || ''}', '${m.title}')" 
                    title="Afficher QR & Lien"
                    style="background:none; border:none; color:var(--primary); cursor:pointer; margin-right:15px; font-size:1.1rem;">
                    <i class="fa-solid fa-qrcode"></i>
                </button>

                <div class="timer-display" id="timer-${index}" 
                     data-start="${m.start_time}" 
                     data-end="${m.end_time || ''}"
                     style="font-size: 1.3rem; font-weight: 700; color: var(--primary); font-family: 'Courier New', monospace; min-width: 90px; text-align: right;">
                    --:--:--
                </div>
            </div>
        </div>
    `).join('');

    // Démarrer l'intervalle pour mettre à jour les minuteurs chaque seconde
    if (runningTimersInterval) clearInterval(runningTimersInterval);
    runningTimersInterval = setInterval(updateAllTimers, 1000);
    updateAllTimers(); // Première mise à jour immédiate
}

function updateAllTimers() {
    document.querySelectorAll('.timer-display').forEach(timerEl => {
        const startTime = new Date(timerEl.dataset.start);
        // Vérifier si end_time est fourni
        if (!timerEl.dataset.end || timerEl.dataset.end === 'null' || timerEl.dataset.end === 'undefined') {
            timerEl.textContent = "En cours";
            timerEl.style.fontSize = "0.9rem";
            timerEl.style.color = "var(--primary)";
            return;
        }

        const endTime = new Date(timerEl.dataset.end);
        const now = new Date();

        // Calculer le temps restant jusqu'à la fin
        const remainingMs = endTime - now;

        if (remainingMs < 0) {
            timerEl.textContent = "Terminée";
            timerEl.style.color = "#999";
            timerEl.style.fontSize = "0.9rem";
            return;
        }

        const h = Math.floor(remainingMs / (1000 * 60 * 60));
        const min = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((remainingMs % (1000 * 60)) / 1000);

        timerEl.textContent = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        // Codage couleur basé sur le temps restant
        if (remainingMs < 5 * 60 * 1000) { // Moins de 5 minutes
            timerEl.style.color = '#ef4444'; // Rouge
        } else if (remainingMs < 15 * 60 * 1000) { // Moins de 15 minutes
            timerEl.style.color = '#f59e0b'; // Orange
        } else {
            timerEl.style.color = 'var(--primary)'; // Vert
        }
    });
}

// Récupérer les statistiques de participation
async function fetchParticipationStats() {
    try {
        const res = await fetch('/api/stats/participation/admin?period=week');
        if (res.ok) {
            const data = await res.json();

            if (barChartRef && data.labels && data.meetings && data.attendees) {
                barChartRef.data.labels = data.labels;
                barChartRef.data.datasets[0].data = data.meetings;
                barChartRef.data.datasets[1].data = data.attendees;
                barChartRef.update();
            }
        }
    } catch (err) {
        console.error('Erreur chargement stats participation:', err);
    }
}

// Logique QR
function showQR(uuid, linkStr, title) {
    const modal = document.getElementById('qrModal');
    if (!modal) return;

    document.getElementById('qrModalTitle').innerText = title || 'Réunion';
    // Construct fallback link if undefined
    let finalLink = (linkStr && linkStr !== 'undefined') ? linkStr : `${window.location.origin}/meeting/${uuid}`;
    document.getElementById('qrModalLink').value = finalLink;

    const lobbyEl = document.getElementById('qrModalLobbyLink');
    if (lobbyEl) lobbyEl.value = `${window.location.origin}/lobby/${uuid}`;

    currentQRUuid = uuid;
    modal.style.display = 'flex';

    // Fetch immediately to prevent a broken image icon
    refreshLobbyData();

    // Démarrer la rotation/compte à rebours
    startQRRotation();
}

async function refreshLobbyData() {
    if (!currentQRUuid) return;
    try {
        const res = await fetch(`/api/public/lobby-data/${currentQRUuid}`);
        if (!res.ok) return;
        const data = await res.json();

        // Mise à jour QR
        if (data.qr_code) {
            document.getElementById('qrModalImage').src = data.qr_code;
            document.getElementById('qrModalDownload').href = data.qr_code;
        }

        // Mise à jour Challenge Code
        const el = document.getElementById('qrChallengeCode');
        if (el && data.challenge_code) {
            el.innerText = data.challenge_code;
        }
    } catch (e) { console.error("Lobby data refresh error", e); }
}

function startQRRotation() {
    if (qrRotationInterval) clearInterval(qrRotationInterval);

    const updateQRStatus = () => {
        const now = Date.now();
        const secondsInWindow = Math.floor(now / 1000) % 60;
        const remaining = 60 - secondsInWindow;

        const bar = document.getElementById('qrCountdownBar');
        const text = document.getElementById('qrCountdownText');

        if (bar) bar.style.width = (remaining / 60 * 100) + "%";
        if (text) text.innerText = `Mise à jour dans ${remaining}s`;

        // Si on arrive à la fin d'une fenêtre (ou au début d'une nouvelle)
        if (remaining === 60 || remaining === 59) {
            refreshLobbyData();
        }
    };

    qrRotationInterval = setInterval(updateQRStatus, 1000);
    updateQRStatus(); // Initial
}


// Arrêter la rotation quand on ferme la modale
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'none';
    if (qrRotationInterval) {
        clearInterval(qrRotationInterval);
        qrRotationInterval = null;
    }
    currentQRUuid = null;
}

function copyLink(id = 'qrModalLink') {
    const input = document.getElementById(id);
    if (!input) return;

    input.select();

    if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(() => {
            showToast("Lien copié !", 'success');
        }).catch(() => {
            // Solution de secours
            document.execCommand('copy');
            showToast("Lien copié !", 'success');
        });
    } else {
        document.execCommand('copy');
        showToast("Lien copié !", 'success');
    }
}

// Liaison au niveau global pour les événements onclick du HTML
window.openAgendaModal = openAgendaModal;
window.submitAgendaItem = submitAgendaItem;
window.toggleItem = toggleItem;
window.showQR = showQR;
window.closeQRModal = closeQRModal;
window.copyLink = copyLink;
