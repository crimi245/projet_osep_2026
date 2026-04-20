

function openLogsModal() {
    const modal = document.getElementById('logsModal');
    if (modal) {
        modal.style.display = 'flex';
        fetchFullLogs();
    }
}

function closeLogsModal() {
    const modal = document.getElementById('logsModal');
    if (modal) modal.style.display = 'none';
}

window.onclick = function (event) {
    const modal = document.getElementById('logsModal');
    if (event.target == modal) {
        closeLogsModal();
    }
}

async function fetchFullLogs() {
    const userFilter = document.getElementById('logFilterUser');
    const actionFilter = document.getElementById('logFilterAction');
    const levelFilter = document.getElementById('logFilterLevel');

    const user = userFilter ? userFilter.value : '';
    const action = actionFilter ? actionFilter.value : '';
    const level = levelFilter ? levelFilter.value : '';

    const container = document.getElementById('fullLogsContainer') || document.getElementById('activityLogsList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:40px; color:#666;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; margin-bottom:10px;"></i><br>Chargement...</div>';

    try {
        const query = new URLSearchParams({ user, action, level, limit: 50 }).toString();
        const res = await fetch(`/api/admin/logs/all?${query}`);

        if (res.ok) {
            window.allLogs = await res.json();
            const logs = window.allLogs;
            container.innerHTML = '';

            if (logs.length === 0) {
                container.innerHTML = '<p style="text-align:center; margin-top:20px; color:#999;">Aucun journal trouvé.</p>';
                return;
            }

            logs.forEach((l, index) => {
                const date = new Date(l.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const fullDateStr = date.toLocaleDateString() + ' ' + timeStr;

                let typeClass = 'info';
                let iconClass = 'fa-info';
                let cardBorderColor = 'transparent';

                if (l.level === 'WARN') { typeClass = 'warn'; iconClass = 'fa-triangle-exclamation'; cardBorderColor = '#f59e0b'; }
                if (l.level === 'ERROR') { typeClass = 'error'; iconClass = 'fa-circle-xmark'; cardBorderColor = '#ef4444'; }

                if (l.action && l.action.includes('LOGIN')) { iconClass = 'fa-right-to-bracket'; typeClass = 'info'; }
                if (l.action && l.action.includes('MEETING')) { iconClass = 'fa-calendar-check'; typeClass = 'success'; }
                if (l.action && l.action.includes('DELETE')) { iconClass = 'fa-trash-can'; typeClass = 'error'; }
                if (l.action && l.action.includes('UPDATE')) { iconClass = 'fa-pen-to-square'; typeClass = 'warn'; }

                let metaObj = {};
                try { metaObj = typeof l.meta === 'string' ? JSON.parse(l.meta) : l.meta; } catch (e) { }
                let metaHtml = '';
                if (metaObj && Object.keys(metaObj).length > 0) {
                    metaHtml = `<div class="log-meta" title='${JSON.stringify(metaObj)}'><i class="fa-solid fa-code"></i> Données JSON : Détails en console</div>`;
                }

                const html = `
                <div class="log-item" style="border-left: 4px solid ${cardBorderColor === 'transparent' ? '#e5e7eb' : cardBorderColor}; padding-left:10px; margin-bottom:10px; background:#fff; padding:10px; border-radius:4px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick="setFilterUser('${l.username || ''}')" title="Filtrer">${l.username || 'Système'}</span>
                        <span style="font-size:0.75rem; color:#888;" title="${fullDateStr}">${timeStr}</span>
                    </div>
                    <div style="font-size:0.85rem; margin-bottom:5px;">
                        <i class="fa-solid ${iconClass}"></i> <strong>${l.action}</strong>
                    </div>
                    ${metaHtml}
                    <div style="text-align:right;">
                        <button style="border:none;background:none;cursor:pointer;color:#888;font-size:0.8rem;" onclick="showLogDetails(${index})">Détails <i class="fa-regular fa-eye"></i></button>
                    </div>
                </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });

        } else {
            container.innerHTML = '<p style="text-align:center; color:#ef4444;">Erreur de chargement</p>';
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; color:#ef4444;">Erreur réseau</p>';
    }
}

function setFilterUser(username) {
    if (!username) return;
    const input = document.getElementById('logFilterUser');
    if (input) {
        input.value = username;
        fetchFullLogs();
    }
}

function showLogDetails(index) {
    if (window.allLogs && window.allLogs[index]) {
        console.log("Log Details:", window.allLogs[index]);
        if (typeof toast !== 'undefined' && toast.info) {
            toast.info("Détails complets affichés dans la console (F12)");
        } else {
            alert("Détails affichés dans la console (Appuyez sur F12)");
        }
    }
}