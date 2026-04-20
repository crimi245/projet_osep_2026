function getSmartGreeting(userName) {
    const hour = new Date().getHours();
    const greetings = {
        morning: [
            `Bonjour ${userName}, belle journée aujourd’hui !`,
            `Bon réveil ${userName}, prêt pour une journée productive ?`,
            `Hello ${userName}, le café est chaud ?`
        ],
        afternoon: [
            `Bon après-midi ${userName}.`,
            `Courage pour le reste de la journée ${userName} !`,
            `C’est le moment d’être efficace, ${userName}.`
        ],
        evening: [
            `Bonsoir ${userName}, il se fait tard...`,
            `Bientôt l'heure de se détendre ${userName}.`
        ],
        night: [
            `Il est ${hour}h, pensez à vous reposer ${userName}...`,
            `Douce nuit ${userName}.`
        ]
    };

    let timeKey = 'morning';
    if (hour >= 12 && hour < 18) timeKey = 'afternoon';
    else if (hour >= 18 && hour < 22) timeKey = 'evening';
    else if (hour >= 22 || hour < 6) timeKey = 'night';

    const options = greetings[timeKey];
    return options[Math.floor(Math.random() * options.length)];
}

function updateGreeting(user) {
    const name = user.fullname || user.username || "Utilisateur";
    const prefix = user.gender === 'F' ? 'Madame' : 'Monsieur';
    const enabled = localStorage.getItem('smart_greeting') !== 'false'; // Default true

    const greetingElement = document.getElementById('smartGreeting');
    if (!greetingElement) return;

    if (enabled) {
        greetingElement.innerText = getSmartGreeting(`${prefix} ${name}`);
    } else {
        const hour = new Date().getHours();
        const simple = hour < 18 ? "Bonjour" : "Bonsoir";
        greetingElement.innerText = `${simple} ${prefix} ${name}`;
    }
}

function toggleSmartGreeting() {
    const current = localStorage.getItem('smart_greeting') !== 'false';
    localStorage.setItem('smart_greeting', !current);
    // Reload greeting immediately
    // Need current user info, maybe store globally or re-fetch
    if (window.currentUser) {
        updateGreeting(window.currentUser);
    }
    updateToggleBtnState();
}

function updateToggleBtnState() {
    const btn = document.getElementById('toggleGreetingBtn');
    if (btn) {
        const enabled = localStorage.getItem('smart_greeting') !== 'false';
        btn.innerText = enabled ? "Désactiver Messages Intelligents" : "Activer Messages Intelligents";
        btn.className = enabled ? "btn-light" : "btn-dark"; // Visual feedback
    }
}
