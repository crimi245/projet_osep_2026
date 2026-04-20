document.addEventListener("DOMContentLoaded", function () {

    // ─── Données mensuelles (issues de l'API) ───────────────────────────────
    const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const anneeActuelle = new Date().getFullYear();
    const anneePrecedente = anneeActuelle - 1;

    const startDateInput = document.getElementById('filterStartDate');
    const endDateInput = document.getElementById('filterEndDate');

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

    // Initialisation par défaut : Année en cours (pour afficher les réunions de l'année)
    if (startDateInput && !startDateInput.value) startDateInput.value = yearStart;
    if (endDateInput && !endDateInput.value) endDateInput.value = yearEnd;

    // ─── Gestion du Budget Editable ─────────────────────────────────────────
    const budgetAmountInput = document.getElementById('budgetAmount');
    const budgetPeriodSelect = document.getElementById('budgetPeriod');
    const budgetLabelDisplay = document.getElementById('budgetLabelDisplay');

    function loadBudget() {
        if (!budgetAmountInput || !budgetPeriodSelect) return;
        const savedAmount = localStorage.getItem('staff_budget_amount');
        const savedPeriod = localStorage.getItem('staff_budget_period') || 'annee';

        if (savedAmount) budgetAmountInput.value = savedAmount;
        budgetPeriodSelect.value = savedPeriod;
        updateBudgetLabelDisp(savedPeriod);
    }

    function saveBudget() {
        if (!budgetAmountInput || !budgetPeriodSelect) return;
        localStorage.setItem('staff_budget_amount', budgetAmountInput.value);
        localStorage.setItem('staff_budget_period', budgetPeriodSelect.value);
        updateBudgetLabelDisp(budgetPeriodSelect.value);
    }

    function updateBudgetLabelDisp(val) {
        if (!budgetLabelDisplay) return;
        if (val === 'hebdo') budgetLabelDisplay.innerText = 'la semaine';
        else if (val === 'mois') budgetLabelDisplay.innerText = 'le mois';
        else budgetLabelDisplay.innerText = "l'année";
    }

    if (budgetAmountInput) budgetAmountInput.addEventListener('input', saveBudget);
    if (budgetPeriodSelect) budgetPeriodSelect.addEventListener('change', saveBudget);
    loadBudget();

    // Écouteurs pour les filtres
    [startDateInput, endDateInput].forEach(sel => {
        if (sel) {
            sel.addEventListener('change', () => {
                updateDateLabel();
                fetchDashboardData();
                fetchMeetingStats();
                fetchBIFinanceStats();
                fetchStaffAlerts();
            });
        }
    });

    // Mise à jour du libellé de période
    function updateDateLabel() {
        const lblDate = document.getElementById('lblDateRange');
        if (!lblDate || !startDateInput || !endDateInput) return;

        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);

        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        lblDate.textContent = `${start.toLocaleDateString('fr-FR', options)} – ${end.toLocaleDateString('fr-FR', options)}`;
    }

    // ─── Chargement initial ─────────────────────────────────────────────────
    fetchDashboardData();
    fetchMeetingStats();
    fetchBIFinanceStats();
    fetchStaffAlerts();

    async function fetchStaffAlerts() {
        const sd = startDateInput ? startDateInput.value : '';
        const ed = endDateInput ? endDateInput.value : '';
        try {
            const res = await fetch(`/api/staff/stats/alerts?startDate=${sd}&endDate=${ed}`);
            const data = await res.json();
            const countElem = document.getElementById('staffAlertCount');
            const listElem = document.getElementById('staffAlertsList');
            if (data.success && data.alerts.length > 0) {
                if (countElem) {
                    countElem.innerText = data.alerts.length;
                    countElem.style.display = 'block';
                }
                if (listElem) {
                    listElem.innerHTML = data.alerts.map(a => `
                        <div style="padding:10px; border-bottom:1px solid #f8fafc; cursor:pointer;" onclick="openRapprochementModal('${a.id}', '${(a.title || '').replace(/'/g, "\\'")}')">
                            <div style="font-weight:600; font-size:0.85rem; color:#1e293b;">${a.title}</div>
                            <div style="font-size:0.75rem; color:#ef4444;">${a.en_attente} en attente</div>
                        </div>
                    `).join('');
                }
            } else {
                if (countElem) countElem.style.display = 'none';
                if (listElem) listElem.innerHTML = '<p style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:10px;">Aucune alerte</p>';
            }
        } catch (e) { console.error("Erreur alertes:", e); }
    }

    window.toggleAlertsDropdown = function () {
        const dd = document.getElementById('staffAlertsDropdown');
        if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    };

    // Fermer le dropdown si on clique ailleurs
    document.addEventListener('click', (e) => {
        const dd = document.getElementById('staffAlertsDropdown');
        const container = document.getElementById('staffAlertsContainer');
        if (dd && container && !container.contains(e.target)) {
            dd.style.display = 'none';
        }
    });

    async function fetchDashboardData() {
        const sd = startDateInput ? startDateInput.value : '';
        const ed = endDateInput ? endDateInput.value : '';

        try {
            const res = await fetch(`/api/staff/stats/overview?startDate=${sd}&endDate=${ed}`);
            const data = await res.json();

            if (data.success) {
                updateKPIs(data);
                initChart(data);
                buildTable(data);
            } else {
                displayEmptyData();
            }
        } catch (err) {
            console.warn("API indisponible, données vides par défaut.", err);
            displayEmptyData();
        }
    }

    async function fetchMeetingStats() {
        const sd = startDateInput ? startDateInput.value : '';
        const ed = endDateInput ? endDateInput.value : '';
        try {
            const res = await fetch(`/api/staff/stats/per-meeting?startDate=${sd}&endDate=${ed}`);
            const data = await res.json();
            if (data.success) {
                populateActivityLists(data.meetings);
            }
        } catch (err) {
            console.error("Erreur fetchMeetingStats:", err);
        }
    }

    function populateActivityLists(meetings) {
        const managedList = document.getElementById('managedMeetingsList');
        const createdList = document.getElementById('createdMeetingsList');
        const urgentList = document.getElementById('urgentValidations');
        if (!managedList || !createdList || !urgentList) return;

        // 1. Réunions Gérées (CCMS + Partenaires à incidence financière)
        let managedHtml = '';
        const managedMeetings = meetings.filter(m => m.meeting_type === 'ccms' || (m.meeting_type === 'partenaire_externe' && m.financial_impact));

        managedMeetings.slice(0, 5).forEach(m => {
            const dateStr = new Date(m.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            managedHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="background:#f1f5f9; padding:8px; border-radius:8px; text-align:center; min-width:45px;">
                        <div style="font-size:0.7rem; font-weight:700; color:var(--db-blue); text-transform:uppercase;">${dateStr.split(' ')[1]}</div>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--db-text);">${dateStr.split(' ')[0]}</div>
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:0.95rem; color:var(--db-text);">${m.title}</div>
                        <div style="font-size:0.8rem; color:var(--db-muted);">${m.total_participants} inscrits • <span style="color:#2563eb; font-weight:600;">${m.meeting_type === 'ccms' ? 'CCMS' : 'Partenaire'}</span></div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${m.en_attente == 0 ? 'status-valide' : 'status-attente'}" style="font-size:0.75rem;">
                        ${m.en_attente == 0 ? 'Tout validé' : m.en_attente + ' à valider'}
                    </span>
                </div>
            </div>`;
        });
        managedList.innerHTML = managedHtml || '<div style="text-align:center; color:#999; padding:20px;">Aucune réunion gérée récemment</div>';

        // 2. Mes Réunions Créées (Inter / Intra)
        let createdHtml = '';
        const createdMeetings = meetings.filter(m => ['inter', 'intra'].includes(m.meeting_type));

        createdMeetings.slice(0, 5).forEach(m => {
            const dateStr = new Date(m.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            createdHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="background:#f1f5f9; padding:8px; border-radius:8px; text-align:center; min-width:45px;">
                        <div style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">${dateStr.split(' ')[1]}</div>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--db-text);">${dateStr.split(' ')[0]}</div>
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:0.95rem; color:var(--db-text);">${m.title}</div>
                        <div style="font-size:0.8rem; color:var(--db-muted);">${m.total_participants} inscrits • <span style="font-weight:600; color:#64748b;">${m.meeting_type === 'intra' ? 'Intra' : 'Inter'}</span></div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge status-valide" style="font-size:0.75rem; background:#f1f5f9; color:#64748b; border:none;">
                        Créée
                    </span>
                </div>
            </div>`;
        });
        createdList.innerHTML = createdHtml || '<div style="text-align:center; color:#999; padding:20px;">Aucune réunion créée récemment</div>';

        // 3. À valider absolument (Urgent)
        const sortedUrgent = [...managedMeetings].filter(m => parseInt(m.en_attente) > 0).sort((a, b) => b.en_attente - a.en_attente);
        let urgentHtml = '';
        sortedUrgent.slice(0, 6).forEach(m => {
            const progress = Math.round((m.valides / m.total_participants) * 100) || 0;
            urgentHtml += `
            <div style="margin-bottom:15px; padding:12px; background:rgba(255,255,255,0.1); border-radius:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem; font-weight:500;">
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; color:white;">${m.title}</span>
                    <span style="font-weight:700; color:white; background:rgba(239, 68, 68, 0.4); padding:2px 8px; border-radius:6px;">${m.en_attente} à valider</span>
                </div>
                <div style="height:6px; background:rgba(255,255,255,0.2); border-radius:3px; overflow:hidden;">
                    <div style="width:${progress}%; height:100%; background:white; transition:width 0.5s;"></div>
                </div>
            </div>`;
        });
        urgentList.innerHTML = urgentHtml || '<div style="text-align:center; color:rgba(255,255,255,0.7); padding:10px;">Rien en attente actuellement</div>';
    }

    function updateKPIs(data) {
        animateValue('kpiTotalMeetings', 0, data.total_meetings || 0, 1000);

        // Taux de validation
        const rate = data.taux_completion || 0;
        animateValue('kpiAttendanceRate', 0, rate, 1000, '%');

        setText('kpiParticipantsCount', `${data.total_participants || 0} participants au total`);

        // Montants avec animation (simplifiée pour les gros chiffres)
        // setText('kpiBudgetTotal', fmt(data.budget_total)); // Remplacé par un input manuel (budgetAmount)
        setText('kpiMontantVerse', fmt(data.montant_verse));

        // Optionnel : Tendance (calcul simple basé sur le total actuel vs total précédent si dispo)
        const totalPrev = (data.monthly_stats_prev || []).reduce((acc, curr) => acc + (curr.total || 0), 0);
        const trendElem = document.querySelector('.kpi-trend span');
        if (trendElem && totalPrev > 0) {
            const trend = ((data.total_meetings - totalPrev) / totalPrev * 100).toFixed(1);
            trendElem.textContent = (trend > 0 ? '+' : '') + trend + '%';
            trendElem.parentElement.className = `kpi-trend ${trend >= 0 ? 'positive' : 'negative'}`;
            trendElem.parentElement.querySelector('i').className = `fa-solid fa-arrow-${trend >= 0 ? 'up' : 'down'}`;
        }
    }

    function animateValue(id, start, end, duration, suffix = '') {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = Math.floor(progress * (end - start) + start);
            obj.innerHTML = val + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // ─── Données de fallback retirées au profit de données réelles (vides si erreur) ───
    function displayEmptyData() {
        const empty = {
            total_meetings: 0,
            taux_completion: 0,
            total_participants: 0,
            budget_total: 0,
            montant_verse: 0,
            monthly_stats: [],
            monthly_stats_prev: []
        };
        updateKPIs(empty);
        initChart(empty);
        buildTable(empty);
    }

    // ─── Graphique linéaire ──────────────────────────────────────────────────
    let staffChart = null;

    function initChart(data) {
        const ctx = document.getElementById('statsChart').getContext('2d');
        if (!ctx) return;

        // Détruire l'instance précédente si elle existe
        if (staffChart) {
            staffChart.destroy();
        }

        const labels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

        const stats = data.monthly_stats || [];
        const statsPrev = data.monthly_stats_prev || [];

        const dataSelected = new Array(12).fill(0);
        stats.forEach(s => {
            if (s.mois_num) {
                dataSelected[s.mois_num - 1] = s.count !== undefined ? s.count : ((s.intra || 0) + (s.inter || 0) + (s.ccms || 0));
            }
        });

        const dataPreceding = new Array(12).fill(0);
        statsPrev.forEach(s => {
            if (s.mois_num) {
                dataPreceding[s.mois_num - 1] = s.total || 0;
            }
        });

        const gradient = ctx.createLinearGradient(0, 0, 0, 290);
        gradient.addColorStop(0, 'rgba(16, 163, 74, 0.15)'); // Emerald opaque
        gradient.addColorStop(1, 'rgba(16, 163, 74, 0)');

        staffChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Période actuelle',
                        data: dataSelected,
                        borderColor: '#16a34a', // Emerald
                        backgroundColor: gradient,
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#16a34a',
                        pointRadius: 0,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Période précédente',
                        data: dataPreceding,
                        borderColor: '#d1d5db',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#111827',
                        titleFont: { family: 'Inter', size: 13 },
                        bodyFont: { family: 'Inter', size: 13 },
                        padding: 10,
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y} réunions`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6b7280', font: { family: 'Inter', size: 12 } },
                        title: { display: true, text: 'Mois', color: '#111827', font: { family: 'Inter', size: 12, weight: '500' } }
                    },
                    y: {
                        min: 0,
                        grid: { color: '#f3f4f6' },
                        ticks: { color: '#6b7280', font: { family: 'Inter', size: 12 } },
                        title: { display: true, text: 'Nombre de réunions', color: '#111827', font: { family: 'Inter', size: 12, weight: '500' } }
                    }
                },
                interaction: { mode: 'nearest', axis: 'x', intersect: false }
            }
        });
    }

    // ─── Tableau des statistiques mensuelles ─────────────────────────────────
    function buildTable(data) {
        const tbody = document.getElementById('statsTableBody');
        if (!tbody) return;

        const stats = data.monthly_stats || [];

        // Calcul des totaux
        let totNb = 0, totM = 0;
        stats.forEach(s => {
            totNb += s.count || 0;
            totM += s.montant || 0;
        });

        let html = `<tr class="row-total">
            <td>Total Annuel</td>
            <td class="text-right">${totNb}</td>
            <td class="text-right">${fmt(totM)}</td>
        </tr>`;

        stats.forEach((s, i) => {
            html += `<tr>
                <td>${s.mois || mois[i]} ${anneeActuelle}</td>
                <td class="text-right">${s.count || 0}</td>
                <td class="text-right">${fmt(s.montant || 0)}</td>
            </tr>`;
        });

        tbody.innerHTML = html || `<tr><td colspan="3" style="text-align:center;color:#999;padding:24px;">Aucune donnée CCMS disponible</td></tr>`;
    }

    // ─── Formatage FCFA ──────────────────────────────────────────────────────
    function fmt(val) {
        if (!val) return '0 FCFA';
        return new Intl.NumberFormat('fr-FR').format(Math.round(val)) + ' FCFA';
    }

    // Fonctions d'export retirées du dashboard sur demande utilisateur
    // (Considérer l'utilisation de la page des statistiques pour des exports détaillés si besoin)

    async function fetchBIFinanceStats() {
        const sd = startDateInput ? startDateInput.value : '';
        const ed = endDateInput ? endDateInput.value : '';
        try {
            const res = await fetch(`/api/stats/finance/overview?startDate=${sd}&endDate=${ed}`);
            if (res.ok) {
                const data = await res.json();
                const locale = 'fr-FR';
                const formatCurrency = (val) => new Intl.NumberFormat(locale).format(val) + " FCFA";

                const valElem = document.getElementById('biTotalValide');
                const attElem = document.getElementById('biTotalEnAttente');

                if (valElem) valElem.textContent = formatCurrency(data.summary.total_valide);
                if (attElem) attElem.textContent = "En attente: " + formatCurrency(data.summary.total_en_attente);
            }
        } catch (e) { console.error("Erreur BI Stats:", e); }
    }

    // ─── Logique de Rapprochement One-Click ──────────────────────────────
    window.openRapprochementModal = function (id, title) {
        const modal = document.getElementById('modalRapprochement');
        const idInput = document.getElementById('rapMeetingId');
        const titleSpan = document.getElementById('rapTitle');
        const nameElem = document.getElementById('fileName');
        const fileInput = document.getElementById('fileInput');

        if (idInput) idInput.value = id;
        if (titleSpan) titleSpan.innerText = title;
        if (nameElem) nameElem.innerText = '';
        if (fileInput) fileInput.value = '';
        if (modal) modal.style.display = 'flex';
    };

    window.closeRapprochementModal = function () {
        const modal = document.getElementById('modalRapprochement');
        if (modal) modal.style.display = 'none';
    };

    window.updateFileName = function (input) {
        const name = input.files[0] ? input.files[0].name : '';
        const nameElem = document.getElementById('fileName');
        if (nameElem) nameElem.innerText = name;
    };

    window.submitRapprochement = async function (e) {
        e.preventDefault();
        const id = document.getElementById('rapMeetingId').value;
        const fileInput = document.getElementById('fileInput');

        if (!fileInput.files[0]) {
            if (typeof toast !== 'undefined') toast.error("Veuillez choisir un fichier Excel.");
            return;
        }

        const formData = new FormData();
        formData.append('fichier', fileInput.files[0]);

        try {
            if (typeof toast !== 'undefined') toast.info("Traitement du fichier en cours...");
            const res = await fetch(`/api/staff/rapprochement/${id}`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                if (typeof toast !== 'undefined') toast.success(data.message);
                closeRapprochementModal();
                fetchDashboardData();
                fetchMeetingStats();
                fetchStaffAlerts(); // Rafraîchir les alertes
            } else {
                if (typeof toast !== 'undefined') toast.error(data.message || "Erreur lors du rapprochement.");
            }
        } catch (err) {
            console.error(err);
            if (typeof toast !== 'undefined') toast.error("Erreur réseau lors de l'upload.");
        }
    };
});
