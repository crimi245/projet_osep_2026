/**
 * Mises à jour du tableau de bord en temps réel
 * Interroge l'API toutes les 15 secondes pour mettre à jour les statistiques et l'état de la réunion.
 * Utilise l'API Page Visibility pour suspendre le sondage lorsque l'onglet est masqué.
 */

const POLLING_INTERVAL = 15000; // 15 secondes
let intervalId = null;

async function updateDashboard() {
    try {
        // 1. Récupérer les statistiques globales
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();

        if (stats) {
            updateElement('totalMeetings', stats.totalMeetings);
            updateElement('activeMeetings', stats.activeMeetings);
            updateElement('attendeesCount', stats.attendees);
            // supervisors is often static or less frequent, but we can update
        }

        // 2. Récupérer l'état de la réunion actuelle
        const meetingRes = await fetch('/api/dashboard/current-meeting');
        const meeting = await meetingRes.json();

        const meetingContainer = document.getElementById('currentMeetingContainer');
        if (meeting) {
            if (meetingContainer) {
                meetingContainer.innerHTML = `
                    <h3>${meeting.title}</h3>
                    <p>Début: ${new Date(meeting.start_time).toLocaleTimeString()}</p>
                    <span class="badge badge-success">En cours</span>
                `;
            }
        } else {
            if (meetingContainer) meetingContainer.innerHTML = '<p class="text-muted">Aucune réunion en cours</p>';
        }

    } catch (err) {
        console.warn('Échec de la mise à jour du dashboard:', err);
    }
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function startPolling() {
    updateDashboard(); // Exécution initiale
    intervalId = setInterval(updateDashboard, POLLING_INTERVAL);
}

function stopPolling() {
    if (intervalId) clearInterval(intervalId);
}

// Page Visibility API
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPolling();
    } else {
        startPolling();
    }
});

// Démarrer au chargement
if (!document.hidden) {
    startPolling();
}
