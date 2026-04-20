// CONFIGURATION
const MAX_HOURS = 12; // Sécurité : arrêt auto après 12h
let seconds = 0;
let timerInterval = null;
let isRunning = false;

// DOM Elements
const displayTime = document.getElementById('chronometer');
const statusText = document.getElementById('timerStatus');
const botAvatar = document.getElementById('botAvatar');
const botMsg = document.getElementById('botMessage');
const userEmailDisplay = document.getElementById('displayUserEmail');

// 1. INITIALISATION (Au chargement de la page)
document.addEventListener('DOMContentLoaded', () => {
    // Récupérer l'email de l'étape 1
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
        userEmailDisplay.innerText = savedEmail;
        // On prend juste le début de l'email pour être sympa
        const shortName = savedEmail.split('@')[0];
        botSpeak(`Bonjour ${shortName} ! Je suis prête pour le suivi.`);
    }
});

// 2. FONCTIONS DU TIMER (Suivi du temps)

function updateTimerDisplay() {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const format = (num) => num < 10 ? `0${num}` : num;
    displayTime.innerText = `${format(h)}:${format(m)}:${format(s)}`;

    // SECURITÉ 12H
    if (h >= MAX_HOURS) {
        stopTimerManual();
        botSpeak("⚠️ Sécurité : Réunion stoppée (12h max).");
        toast.error("Limite de sécurité atteinte (12h). Arrêt du chronomètre.");
    }
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    statusText.innerText = "Enregistrement en cours...";
    statusText.style.color = "#4ade80"; // Vert
    botSpeak("C'est parti ! Je chronomètre.");

    timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
    }, 1000);
}

function pauseTimer() {
    if (!isRunning) return;
    clearInterval(timerInterval);
    isRunning = false;
    statusText.innerText = "En pause";
    statusText.style.color = "#facc15"; // Jaune
    botSpeak("Pause notée. On reprend quand vous voulez.");
}

function stopTimerManual() {
    clearInterval(timerInterval);
    isRunning = false;
    statusText.innerText = "Session terminée";
    statusText.style.color = "#ef4444"; // Rouge
    botSpeak("Réunion terminée.");
}

// 3. LOGIQUE DU BOT "MEEA"

function botSpeak(message) {
    botMsg.innerText = message;
    botAvatar.classList.add('bot-active'); // Animation saut
    setTimeout(() => {
        botAvatar.classList.remove('bot-active');
    }, 500);
}

function triggerBot(action) {
    const phrases = {
        'participants': "Je scanne la liste de coordination...",
        'next': "Point suivant noté. J'actualise l'ODJ.",
        'docs': "Accès aux documents sécurisés..."
    };
    const text = phrases[action] || "Je suis là !";
    botSpeak(text);
}

// 4. NAVIGATION FINALE (Vers Signature)
async function goToSignature() {
    // On sauvegarde le temps final pour le réutiliser si besoin
    localStorage.setItem('meetingDuration', displayTime.innerText);

    const confirmed = await toast.confirm("Confirmer la fin de séance et passer à la signature ?");
    if (confirmed) {
        stopTimerManual();
        // Redirection vers le fichier signature.html (créez-le avec votre code précédent)
        window.location.href = 'signature.html';
    }
}

// 5. DECONNEXION
async function logout() {
    // Handled by dash.html inline script or global function, kept here just in case but empty or delegating
    if (window.logoutMain) window.logoutMain();
    else {
        const confirmed = await toast.confirm("Se déconnecter ?");
        if (confirmed) {
            window.location.href = '/login';
        }
    }
}
// Sidebar logic removed (handled by utils.js)