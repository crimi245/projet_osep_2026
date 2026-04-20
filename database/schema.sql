-- =============================================================================
-- OSEP - Schéma de base de données complet (Production)
-- Généré le : 2026-04-20
-- Base : osep_db | PostgreSQL 18
-- Source : Reconstruit depuis le code source et validé par pg_dump
-- =============================================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. UTILISATEURS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    username            VARCHAR(100) UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    role                VARCHAR(20) DEFAULT 'user'
                            CHECK (role IN ('super_admin', 'admin', 'staff', 'user')),
    full_name           VARCHAR(100),
    theme_color         VARCHAR(20) DEFAULT 'green',
    coordination_id     INTEGER,               -- FK vers coordinations (ajoutée après)
    gender              VARCHAR(1) DEFAULT 'M',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP,             -- Soft delete
    is_active           BOOLEAN DEFAULT TRUE,
    browser_fingerprint JSONB,
    latitude            NUMERIC(9, 6),
    longitude           NUMERIC(10, 6),
    force_disconnect    BOOLEAN DEFAULT FALSE
);

-- =============================================================================
-- 2. COORDINATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS coordinations (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    sigle_coordination  VARCHAR(50),
    head_name           VARCHAR(100),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP              -- Soft delete
);

-- =============================================================================
-- 3. ÉQUIPES (sous-groupes d'une coordination)
-- =============================================================================

CREATE TABLE IF NOT EXISTS teams (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    coordination_id     INTEGER REFERENCES coordinations(id) ON DELETE CASCADE
);

-- =============================================================================
-- 4. MEMBRES DE COORDINATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS coordination_members (
    id                  SERIAL PRIMARY KEY,
    coordination_id     INTEGER REFERENCES coordinations(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    role                VARCHAR(100),
    team_id             INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. RÉUNIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS meetings (
    id                      SERIAL PRIMARY KEY,
    uuid                    UUID DEFAULT uuid_generate_v4() UNIQUE,
    title                   VARCHAR(255) NOT NULL,
    start_time              TIMESTAMP NOT NULL,
    end_time                TIMESTAMP,
    description             TEXT,
    color                   VARCHAR(20) DEFAULT '#3788d8',
    location                VARCHAR(255),
    coordination_id         INTEGER REFERENCES coordinations(id),
    user_id                 INTEGER REFERENCES users(id),
    status                  VARCHAR(20) DEFAULT 'scheduled',
    step_state              JSONB DEFAULT '{}',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at              TIMESTAMP,             -- Soft delete
    force_open              BOOLEAN DEFAULT FALSE,
    -- Personnalisation visuelle
    theme_color_override    TEXT,
    background_type         TEXT DEFAULT 'color',
    background_value        TEXT,
    active_game             TEXT DEFAULT 'bubbles',
    -- Salle d'attente
    waiting_room_opens_at   INTEGER DEFAULT 15,    -- minutes avant start_time
    waiting_room_minutes    INTEGER DEFAULT 30,
    -- Classification
    meeting_type            VARCHAR(30) DEFAULT 'intra'
                                CHECK (meeting_type IN ('intra', 'inter', 'ccms', 'externe', 'codir', 'partenaire_externe', 'Autre')),
    meeting_category        VARCHAR(100) DEFAULT 'Autre',
    priority                VARCHAR(10) DEFAULT 'medium'
                                CHECK (priority IN ('low', 'medium', 'high')),
    -- Géolocalisation
    geo_lat                 NUMERIC(9, 6) DEFAULT 5.359951,
    geo_lon                 NUMERIC(9, 6) DEFAULT -4.008256,
    geo_radius              INTEGER DEFAULT 1000,  -- en mètres
    -- QR Code / Tokens
    token_refresh_interval  INTEGER DEFAULT 60,    -- en secondes
    -- Finances
    financial_impact        BOOLEAN DEFAULT FALSE,
    -- Suivi des modifications
    nombre_modifications    INTEGER DEFAULT 0
);

-- =============================================================================
-- 6. PARTICIPANTS (ÉMARGEMENT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS attendees (
    id                  SERIAL PRIMARY KEY,
    meeting_id          INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    nom                 VARCHAR(100) NOT NULL,
    prenom              VARCHAR(100) NOT NULL,
    fonction            VARCHAR(100),
    email               VARCHAR(150),
    structure           VARCHAR(150),
    telephone           VARCHAR(50),
    signature           TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    team_id             INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    browser_fingerprint JSONB,
    latitude            NUMERIC(9, 6),
    longitude           NUMERIC(10, 6),
    force_disconnect    BOOLEAN DEFAULT FALSE,
    -- Validation financière
    montant             NUMERIC(10, 2),
    signature_finale    BOOLEAN DEFAULT FALSE,
    statut_finance      VARCHAR(50) DEFAULT 'En attente',
    statut_staff        BOOLEAN DEFAULT FALSE
);

-- =============================================================================
-- 7. POINTS À L'ORDRE DU JOUR
-- =============================================================================

CREATE TABLE IF NOT EXISTS agenda_items (
    id                  SERIAL PRIMARY KEY,
    meeting_id          INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. HISTORIQUE DES MODIFICATIONS DE RÉUNIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS historique_modifications_reunions (
    id                  SERIAL PRIMARY KEY,
    reunion_id          INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    utilisateur_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action              VARCHAR(255),
    date_modification   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details             JSONB
);

-- =============================================================================
-- 9. JOURNAUX DE CONNEXION
-- =============================================================================

CREATE TABLE IF NOT EXISTS login_logs (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id),
    device_type         VARCHAR(50),
    user_agent          TEXT,
    ip_address          VARCHAR(50),
    login_time          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10. JOURNAUX SYSTÈME
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_logs (
    id                  SERIAL PRIMARY KEY,
    level               VARCHAR(10) DEFAULT 'INFO',  -- INFO, WARN, ERROR, CRITICAL
    action              VARCHAR(100) NOT NULL,
    user_id             INTEGER REFERENCES users(id),
    meta                JSONB,
    ip_address          VARCHAR(50),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 11. SÉCURITÉ - ÉMARGEMENTS SÉCURISÉS (OTP / Fingerprint)
-- =============================================================================

CREATE TABLE IF NOT EXISTS emargements_securises (
    id                      SERIAL PRIMARY KEY,
    reunion_id              UUID NOT NULL,
    adresse_email           VARCHAR(255),
    empreinte_utilisee      VARCHAR(255),
    preuve_integrite_hash   TEXT,
    date_validation         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 12. SÉCURITÉ - APPAREILS CONNUS (TOFA / Multi-device)
-- =============================================================================

CREATE TABLE IF NOT EXISTS appareils_connus (
    id                      SERIAL PRIMARY KEY,
    adresse_email           VARCHAR(255),
    empreinte_appareil      VARCHAR(255) NOT NULL,
    user_agent              TEXT,
    derniere_utilisation    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (adresse_email, empreinte_appareil)
);

-- =============================================================================
-- 13. SÉCURITÉ - SESSIONS ACTIVES
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions_actives (
    id                  SERIAL PRIMARY KEY,
    jeton_session       UUID DEFAULT uuid_generate_v4(),
    adresse_email       VARCHAR(255),
    appareil_id         INTEGER,
    reunion_id          UUID,
    date_expiration     TIMESTAMP NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 14. SÉCURITÉ - PARTICIPANTS UNIQUES (Registre global)
-- =============================================================================

CREATE TABLE IF NOT EXISTS participants_uniques (
    adresse_email               VARCHAR(255) PRIMARY KEY,
    nom_complet                 VARCHAR(255),
    departement                 VARCHAR(255),
    date_premiere_apparition    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    est_suspendu                BOOLEAN DEFAULT FALSE,
    derniere_validation_admin   TIMESTAMP
);

-- =============================================================================
-- 15. SÉCURITÉ - JOURNAL DE SÉCURITÉ (SIEM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS journal_securite (
    id                      SERIAL PRIMARY KEY,
    reunion_id              UUID,
    adresse_email           VARCHAR(255),
    empreinte_appareil      VARCHAR(255),
    ip_address              VARCHAR(50),
    action                  VARCHAR(50),
    score_confiance_ia      INTEGER,
    metadonnees             JSONB,
    decision                VARCHAR(50),
    date_evenement          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 16. SÉCURITÉ - ÉVÉNEMENTS DE SÉCURITÉ
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_events (
    id              SERIAL PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    ip_address      VARCHAR(45) NOT NULL,
    threat_score    INTEGER DEFAULT 0,
    action_taken    VARCHAR(50),
    details         JSONB,
    user_id         INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 17. SÉCURITÉ - LISTE NOIRE IP
-- =============================================================================

CREATE TABLE IF NOT EXISTS ip_blacklist (
    id              SERIAL PRIMARY KEY,
    ip_address      VARCHAR(45) NOT NULL UNIQUE,
    reason          TEXT NOT NULL,
    blocked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until   TIMESTAMP,
    blocked_by      INTEGER REFERENCES users(id),
    auto_blocked    BOOLEAN DEFAULT FALSE,
    threat_level    VARCHAR(20) DEFAULT 'MEDIUM',
    threat_score    INTEGER DEFAULT 0,
    attempts_count  INTEGER DEFAULT 1,
    last_attempt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 18. SÉCURITÉ - PATTERNS DE MENACES (Regex SIEM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS threat_patterns (
    id              SERIAL PRIMARY KEY,
    pattern_name    VARCHAR(100) NOT NULL,
    pattern_type    VARCHAR(50),
    pattern_regex   TEXT NOT NULL,
    severity        VARCHAR(20) DEFAULT 'MEDIUM',
    score_impact    INTEGER DEFAULT 10,
    auto_block      BOOLEAN DEFAULT FALSE,
    alert_threshold INTEGER DEFAULT 5,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 19. SÉCURITÉ - CONFIGURATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_config (
    id              SERIAL PRIMARY KEY,
    config_key      VARCHAR(100) NOT NULL UNIQUE,
    config_value    TEXT NOT NULL,
    description     TEXT,
    updated_by      INTEGER REFERENCES users(id),
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 20. SÉCURITÉ - QUARANTAINE DES PAYLOADS SUSPECTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS quarantine_payloads (
    id                  SERIAL PRIMARY KEY,
    log_id              INTEGER,
    ip_address          VARCHAR(45),
    payload_type        VARCHAR(50),
    payload_content     TEXT,
    threat_score        INTEGER,
    detected_patterns   JSONB,
    quarantined_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed            BOOLEAN DEFAULT FALSE,
    reviewed_by         INTEGER REFERENCES users(id),
    reviewed_at         TIMESTAMP,
    action_taken        VARCHAR(50),
    notes               TEXT
);

-- =============================================================================
-- TRIGGER : Quota d'appareils par participant (max 4)
-- =============================================================================

CREATE OR REPLACE FUNCTION verifier_quota_appareils() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT COUNT(*) FROM appareils_connus WHERE adresse_email = NEW.adresse_email) >= 4 THEN
        RAISE EXCEPTION 'Quota de 4 appareils atteint pour ce participant';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_quota_appareils
    BEFORE INSERT ON appareils_connus
    FOR EACH ROW EXECUTE FUNCTION verifier_quota_appareils();

-- =============================================================================
-- CLÉS ÉTRANGÈRES (dépendances circulaires résolues)
-- =============================================================================

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS fk_users_coordination;

ALTER TABLE users
    ADD CONSTRAINT fk_users_coordination
    FOREIGN KEY (coordination_id) REFERENCES coordinations(id);

-- =============================================================================
-- INDEX DE PERFORMANCE
-- =============================================================================

-- Meetings
CREATE INDEX IF NOT EXISTS idx_meetings_uuid         ON meetings(uuid);
CREATE INDEX IF NOT EXISTS idx_meetings_user_id      ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time   ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_deleted_at   ON meetings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_meetings_type         ON meetings(meeting_type);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_username        ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_coordination    ON users(coordination_id);

-- Logs
CREATE INDEX IF NOT EXISTS idx_logs_created_at       ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id    ON login_logs(user_id);

-- Attendees
CREATE INDEX IF NOT EXISTS idx_attendees_meeting_id  ON attendees(meeting_id);

-- Security
CREATE INDEX IF NOT EXISTS idx_security_events_ip    ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_type  ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_journal_securite_rid  ON journal_securite(reunion_id);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_active   ON ip_blacklist(ip_address) WHERE is_active = TRUE;

-- Historique
CREATE INDEX IF NOT EXISTS idx_historique_reunion_id ON historique_modifications_reunions(reunion_id);
