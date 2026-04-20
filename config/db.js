const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la connexion
const connectionConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'osep',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    max: 20,                           // Nombre max de connexions dans le pool
    idleTimeoutMillis: 60000,          // Fermer les connexions inactives après 60s
    connectionTimeoutMillis: 10000,    // Attendre 10s avant d'abandonner une connexion
    keepAlive: true,                   // Maintenir les connexions TCP actives
    keepAliveInitialDelayMillis: 10000 // Envoyer keepalive après 10s d'inactivité
};

// Vérifier la présence d'une surcharge DATABASE_URL
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
    }
    : connectionConfig;

const pool = new Pool(poolConfig);

// Gestionnaire d'erreurs global pour le pool
// Empêche l'application de planter sur des erreurs de clients inactifs
pool.on('error', (err, client) => {
    console.error('[DB Pool] Erreur inattendue sur un client inactif:', err.message);
    // Ne pas quitter le processus — le pool va gérer la reconnexion automatiquement
});

// Assistant pour convertir $1, $2 (PG) -> ? (Support SQLite existant)
// Nous migrons VERS Postgres, nous utilisons donc $1, $2 par défaut.
// Changements requis dans le code :
// - SQLite utilisait `?`. Postgres utilise `$1, $2`.
// - L'enveloppe `query` db.js DOIT convertir `?` en `$n` pour minimiser les changements dans les requêtes de server.js !
// - OU nous mettons à jour server.js.
// - STRATÉGIE : Mettre à jour db.js pour auto-convertir `?` en `$1, $2, ...` afin d'éviter un remaniement massif de server.js.

const query = async (text, params = [], retryCount = 0) => {
    const start = Date.now();

    // Auto-convertir ? en $1, $2... pour la compatibilité avec les requêtes existantes
    let queryText = text;
    let paramCount = 0;
    if (queryText.includes('?')) {
        queryText = queryText.replace(/\?/g, () => {
            paramCount++;
            return `$${paramCount}`;
        });
    }

    try {
        const res = await pool.query(queryText, params);
        // Note : l'enveloppe SQLite retournait { rows: ... }. PG retourne un objet avec .rows aussi.
        // Nous pouvons simplement retourner 'res' directement car sa structure correspond à { rows: [...] }.
        return res;
    } catch (err) {
        // Retry automatique une fois sur les erreurs de timeout de connexion
        const isTimeout = err.message && (
            err.message.includes('Connection terminated') ||
            err.message.includes('connection timeout') ||
            err.message.includes('connect ETIMEDOUT')
        );

        if (isTimeout && retryCount < 1) {
            console.warn(`[DB] Timeout détecté, nouvelle tentative dans 500ms... (tentative ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, 500));
            return query(text, params, retryCount + 1);
        }

        // Violations de contraintes obscures (la logique métier gère généralement cela)
        if (err.code !== '23505') {
            console.error('Erreur de requête base de données:', err.message, queryText);
        }
        throw err;
    }
};

const exec = async (text) => {
    const client = await pool.connect();
    try {
        await client.query(text);
    } finally {
        client.release();
    }
};

module.exports = {
    query,
    exec,
    pool // Exporter le pool pour une utilisation avancée
};
