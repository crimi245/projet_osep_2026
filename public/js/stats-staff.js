document.addEventListener("DOMContentLoaded", function () {

    const monthSelector = document.getElementById('filterMonth');
    const yearSelector = document.getElementById('filterYear');
    const typeSelector = document.getElementById('filterType');
    const statusSelector = document.getElementById('filterStatus');
    const lblDate = document.getElementById('lblDateRange');

    let allMeetings = [];
    let chartValidation = null;
    let chartTypes = null;

    // ─── Initialisation Filtres ──────────────────────────────────────────────
    const currentYear = new Date().getFullYear();
    if (yearSelector) {
        yearSelector.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelector.appendChild(opt);
        }
    }

    [monthSelector, yearSelector, typeSelector, statusSelector].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                updateDateLabel();
                loadStats();
            });
        }
    });

    updateDateLabel();
    loadStats();
    fetchStaffAlerts();

    async function fetchStaffAlerts() {
        try {
            const res = await fetch('/api/staff/stats/alerts');
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

    window.toggleAlertsDropdown = function() {
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

    async function loadStats() {
        const m = monthSelector.value;
        const y = yearSelector.value;
        const t = typeSelector.value;
        const s = statusSelector.value;

        try {
            // 1. KPIs Overview
            const ovRes = await fetch(`/api/staff/stats/overview?month=${m}&year=${y}&type=${t}&status=${s}`);
            const ov = await ovRes.json();
            if (ov.success) {
                animateValue('kpiReunions', ov.total_meetings);
                animateValue('kpiParticipants', ov.total_participants);
                animateValue('kpiEnAttente', ov.en_attente);
                animateValue('kpiTauxValidation', Math.round(ov.taux_completion || 0), '%');
                document.getElementById('kpiMontantValide').innerText = formatCurrency(ov.montant_verse);
                animateValue('kpiSignatures', ov.signatures_finales);
                
                renderValidationChart(ov);
            }

            // 2. Per-meeting table
            const mrRes = await fetch(`/api/staff/stats/per-meeting?month=${m}&year=${y}&type=${t}&status=${s}`);
            const mrData = await mrRes.json();
            if (mrData.success) {
                allMeetings = mrData.meetings;
                renderTable(allMeetings);
                renderTypesChart(mrData.meetings);
            }
        } catch (err) {
            console.error("Erreur chargement statistiques:", err);
        }
    }

    function animateValue(id, value, suffix = '') {
        const obj = document.getElementById(id);
        if(!obj) return;
        let start = 0;
        const end = parseInt(value) || 0;
        const duration = 800;
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            obj.innerText = current + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function updateDateLabel() {
        const m = monthSelector.value;
        const y = yearSelector.value;
        if (m === 'all') {
            lblDate.textContent = `1 Janv. ${y} – 31 Déc. ${y}`;
        } else {
            const monthsNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
            lblDate.textContent = `${monthsNames[m-1]} ${y}`;
        }
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('fr-FR').format(Math.round(val || 0)) + ' FCFA';
    }

    function renderTable(meetings) {
        const tbody = document.getElementById('meetingsTableBody');
        if (!meetings || meetings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8; font-style:italic;">Aucune réunion trouvée.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        meetings.forEach(m => {
            const total = parseInt(m.total_participants) || 0;
            const valides = parseInt(m.valides) || 0;
            const attente = parseInt(m.en_attente) || 0;
            const pct = total > 0 ? Math.round((valides / total) * 100) : 0;
            const date = m.start_time ? new Date(m.start_time).toLocaleDateString('fr-FR') : '—';
            
            let typeBadge = '';
            let categoryBadge = '';
            
            // Déterminer la catégorie
            const isManaged = m.meeting_type === 'ccms' || (m.meeting_type === 'partenaire_externe' && m.financial_impact);
            categoryBadge = isManaged ? '<span class="ss-badge valide" style="background:#eff6ff; color:#2563eb; border:1px solid #dbeafe;">Gérée</span>' : '<span class="ss-badge" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;">Créée</span>';

            if (m.meeting_type === 'ccms') typeBadge = '<span class="ss-badge valide">CCMS</span>';
            else if (m.meeting_type === 'intra') typeBadge = '<span class="ss-badge attente">Intra</span>';
            else if (m.meeting_type === 'inter') typeBadge = '<span class="ss-badge attente" style="background:#e2e8f0; color:#475569;">Inter</span>';
            else if (m.meeting_type === 'partenaire_externe') typeBadge = '<span class="ss-badge" style="background:#ede9fe; color:#7c3aed;">Partenaire</span>';
            else typeBadge = `<span class="ss-badge" style="background:#f1f5f9; color:#475569;">${m.meeting_type}</span>`;

            tbody.innerHTML += `
                <tr data-type="${m.meeting_type}">
                    <td>
                        <div style="font-weight:700;">${m.title || 'Sans titre'}</div>
                        <div style="margin-top:4px;">${categoryBadge}</div>
                    </td>
                    <td>${typeBadge}</td>
                    <td>${date}</td>
                    <td>${total} <span style="color:#94a3b8; font-size:0.8em;">part.</span></td>
                    <td>
                        ${valides > 0 ? `<span class="ss-badge valide">${valides} ok</span>` : ''}
                        ${attente > 0 ? `<span class="ss-badge attente" style="margin-left:4px;">${attente} att.</span>` : ''}
                        ${total === 0 ? '<span style="color:#94a3b8">—</span>' : ''}
                    </td>
                    <td>${isManaged && parseFloat(m.montant_valide) > 0 ? formatCurrency(m.montant_valide) : '<span style="color:#94a3b8">—</span>'}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div class="ss-progress-bar" style="width:60px;">
                                <div class="ss-progress-fill" style="width:${pct}%;"></div>
                            </div>
                            <span style="font-size:0.75rem; color:#64748b;">${pct}%</span>
                        </div>
                    </td>
                    <td style="text-align:right;">
                        ${isManaged ? `
                            <button onclick="openRapprochementModal('${m.id}', '${(m.title || 'Sans titre').replace(/'/g, "\\'")}')" class="ss-badge attente" style="border:none; cursor:pointer; background:#fff7ed; color:#ea580c; display:flex; align-items:center; gap:5px; margin-left:auto;">
                                <i class="fa-solid fa-file-import"></i> Rapprocher
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
    }

    // ─── Logique de Rapprochement One-Click ──────────────────────────────────
    window.openRapprochementModal = function(id, title) {
        document.getElementById('rapMeetingId').value = id;
        document.getElementById('rapTitle').innerText = title;
        document.getElementById('fileName').innerText = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('modalRapprochement').style.display = 'flex';
    };

    window.closeRapprochementModal = function() {
        document.getElementById('modalRapprochement').style.display = 'none';
    };

    window.updateFileName = function(input) {
        const name = input.files[0] ? input.files[0].name : '';
        document.getElementById('fileName').innerText = name;
    };

    window.submitRapprochement = async function(e) {
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
                loadStats(); // Recharger les données pour voir les mises à jour
            } else {
                if (typeof toast !== 'undefined') toast.error(data.message || "Erreur lors du rapprochement.");
            }
        } catch (err) {
            console.error(err);
            if (typeof toast !== 'undefined') toast.error("Erreur réseau lors de l'upload.");
        }
    };

    function renderValidationChart(ov) {
        const ctx = document.getElementById('chartValidation').getContext('2d');
        if (chartValidation) chartValidation.destroy();

        chartValidation = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Validés', 'En Attente', 'Total'],
                datasets: [{
                    data: [ov.valides || 0, ov.en_attente || 0, ov.total_participants || 0],
                    backgroundColor: ['#16a34a', '#f59e0b', '#2563eb'],
                    borderRadius: 8,
                    barPercentage: 0.5,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
                }
            }
        });
    }

    function renderTypesChart(meetings) {
        let intraCount = 0, interCount = 0, ccmsCount = 0, partenaireCount = 0;
        meetings.forEach(m => {
            if (m.meeting_type === 'intra') intraCount++;
            else if (m.meeting_type === 'inter') interCount++;
            else if (m.meeting_type === 'ccms') ccmsCount++;
            else if (m.meeting_type === 'partenaire_externe') partenaireCount++;
        });
        const ctx = document.getElementById('chartTypes').getContext('2d');
        if (chartTypes) chartTypes.destroy();

        chartTypes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['CCMS', 'Intra', 'Inter', 'Partenaire'],
                datasets: [{
                    data: [ccmsCount, intraCount, interCount, partenaireCount],
                    backgroundColor: ['#16a34a', '#f59e0b', '#3b82f6', '#7c3aed'],
                    borderWidth: 2,
                    borderColor: '#fff',
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                }
            }
        });
    }

    // Filtre du tableau (Déjà géré par le rechargement global mais on garde la fonction si besoin)
    window.filterTable = function() {
        loadStats();
    };
});
