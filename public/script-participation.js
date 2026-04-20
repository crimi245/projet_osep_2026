let myChart = null;
let currentPeriod = '1J'; // Par défaut
let currentType = 'line'; // Par défaut

document.addEventListener('DOMContentLoaded', function () {
    renderChart();
});

// --- 1. DONNÉES SIMULÉES ---

// Données simples pour la Courbe (Total uniquement)
const dataLine = {
    '1J': { labels: ['08h', '10h', '12h', '14h', '16h', '18h'], data: [5, 12, 8, 15, 14, 6] },
    '1S': { labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'], data: [45, 50, 30, 60, 55] },
    '1M': { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], data: [120, 150, 110, 180] },
    '1A': { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'], data: [400, 450, 300, 500, 600, 550] }
};

// Données détaillées pour les Barres Empilées (Répartition)
const dataBar = {
    '1J': {
        labels: ['08h', '10h', '12h', '14h', '16h', '18h'],
        pres: [3, 8, 5, 10, 10, 4], dist: [2, 4, 3, 5, 4, 2], abs: [1, 0, 2, 0, 1, 3]
    },
    '1S': {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
        pres: [30, 35, 20, 40, 35], dist: [15, 15, 10, 20, 20], abs: [5, 2, 8, 1, 5]
    },
    '1M': {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        pres: [80, 100, 70, 120], dist: [40, 50, 40, 60], abs: [10, 15, 20, 5]
    },
    '1A': {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
        pres: [250, 300, 200, 350, 400, 380], dist: [150, 150, 100, 150, 200, 170], abs: [20, 10, 50, 20, 10, 30]
    }
};

// --- 2. FONCTIONS DE CONTRÔLE ---

function updatePeriod(period, btn) {
    // Gestion des boutons actifs
    document.querySelectorAll('.filters-container:first-child .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentPeriod = period;
    renderChart();
}

function switchChartType(type, btn) {
    // Gestion des boutons actifs
    document.querySelectorAll('.filters-container:last-child .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentType = type;
    renderChart();
}

// --- 3. RENDU DU GRAPHIQUE ---

function renderChart() {
    const ctx = document.getElementById('participationChart').getContext('2d');

    // Si un graphique existe déjà, on le détruit pour en recréer un proprement
    if (myChart) {
        myChart.destroy();
    }

    // Helper for CSS vars
    const getVar = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
    const primary = getVar('--primary');
    const primaryDark = getVar('--primary-dark');

    // Configuration commune
    let config = {
        type: currentType,
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: getVar('--text-main') } } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: getVar('--text-muted') } },
                x: { grid: { display: false }, ticks: { color: getVar('--text-muted') } }
            }
        }
    };

    // LOGIQUE SELON LE TYPE CHOISI
    if (currentType === 'line') {
        // --- MODE COURBE (Vue globale) ---
        const d = dataLine[currentPeriod];
        config.data.labels = d.labels;
        config.data.datasets = [{
            label: 'Participation Totale',
            data: d.data,
            borderColor: primary,
            backgroundColor: primary + '20', // Opacity 20 hex
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#fff',
            pointBorderColor: primary,
            pointRadius: 6
        }];

    } else {
        // --- MODE BARRES EMPILÉES (Vue détaillée) ---
        const d = dataBar[currentPeriod];
        config.data.labels = d.labels;

        // On active l'empilement (stacking) dans les options
        config.options.scales.x.stacked = true;
        config.options.scales.y.stacked = true;

        config.data.datasets = [
            {
                label: 'Présentiel',
                data: d.pres,
                backgroundColor: primaryDark,
                borderRadius: 4
            },
            {
                label: 'Distanciel',
                data: d.dist,
                backgroundColor: primary,
                borderRadius: 4
            },
            {
                label: 'Absents',
                data: d.abs,
                backgroundColor: '#e5e7eb', // Gris
                borderRadius: 4
            }
        ];
    }

    // Création du graphique
    myChart = new Chart(ctx, config);
}

// Listen for theme changes from theme.js
window.addEventListener('themeChanged', () => {
    renderChart();
});


