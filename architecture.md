# Architecture du Projet OSEP CI — Documentation Complète

Ce document décrit en détail l'arborescence complète du projet de gestion de réunions OSEP CI, ainsi que le rôle de **chaque dossier** et de **chaque fichier** (HTML, CSS, JavaScript, SQL, etc.).

L'application repose sur une architecture **Monolithe Modulaire** basée sur **Node.js, Express, PostgreSQL** et une interface front-end classique (**HTML, CSS, Vanilla JS**).

---

## Vue d'Ensemble de l'Arborescence

```text
projet_osep/
│
├── backups/                    # Sauvegardes JSON de la base de données
├── config/                     # Configuration de la connexion PostgreSQL
│   └── db.js
│
├── controleurs/                # Logique métier — traitement des requêtes API
│   ├── controleurAuth.js
│   ├── controleurBI.js
│   ├── controleurCalendrier.js
│   ├── controleurCoordination.js
│   ├── controleurReunion.js
│   ├── controleurSecurite.js
│   ├── controleurSiemAvance.js
│   ├── controleurStaffStats.js
│   └── controleurUtilisateur.js
│
├── database/                   # Schéma de référence de la base de données
│   └── schema.sql              # (Migrations déplacées dans backups/migrations/)
│
├── logs/                       # Journaux de l'application (erreurs, accès)
│
├── middlewares/                # Filtres exécutés avant les contrôleurs
│   ├── middlewareAuth.js
│   ├── barreLateraleDynamique.js
│   ├── elementsBarreLaterale.js
│   ├── edr.js
│   └── securite.js
│
├── public/                     # Fichiers statiques envoyés au navigateur
│   ├── css/
│   │   ├── theme.css
│   │   ├── sidebar.css
│   │   ├── dashboard-staff.css
│   │   └── stats-staff.css
│   │
│   ├── js/
│   │   ├── theme.js
│   │   ├── toast.js
│   │   ├── dashboard-logic.js
│   │   ├── dashboard-staff.js
│   │   ├── realtime-dashboard.js
│   │   ├── script-participation.js
│   │   ├── script-admin-calendar.js
│   │   ├── script-calendar.js
│   │   ├── live-search.js
│   │   ├── fingerprint.js
│   │   ├── profile-dropdown.js
│   │   ├── smart_greeting.js
│   │   ├── stats-staff.js
│   │   └── utils.js
│   │
│   └── uploads/               # Photos de profil uploadées par les utilisateurs
│
├── routes/                     # Définition des endpoints API
│   ├── routesAuth.js
│   ├── routesPubliques.js
│   ├── routesCoordination.js
│   ├── routesSecurite.js
│   ├── routesStats.js
│   ├── routesUtilisateur.js
│   └── staffRoutes.js
│
├── scripts/                    # Scripts d'automatisation et utilitaires
│
├── tests/                      # Jeux de tests HTTP et d'intégration
│
├── uploads/                    # Pièces jointes uploadées (côté serveur)
│
├── utilitaires/                # Bibliothèques de fonctions transversales
│   ├── generateurPdf.js
│   ├── journaliseur.js
│   ├── serviceSecurite.js
│   └── validateurs.js
│
├── views/                      # Pages HTML de l'interface utilisateur
│   ├── connexion.html
│   ├── tableau-de-bord-admin.html
│   ├── tableau-de-bord.html
│   ├── gestion-staff.html
│   ├── gestion-utilisateurs.html
│   ├── gestion-coordinations.html
│   ├── gestion-experience.html
│   ├── nouvelle-reunion-admin.html
│   ├── nouvelle-reunion-utilisateur.html
│   ├── nouvelle-coordination.html
│   ├── formulaire-interne.html
│   ├── participation.html
│   ├── participation-utilisateur.html
│   ├── participation-interne.html
│   ├── liens-reunion.html
│   ├── liens-reunion-utilisateur.html
│   ├── lobby-reunion.html
│   ├── qr-reunion.html
│   ├── reunion-terminee.html
│   ├── historique-journaux.html
│   ├── logs-securite.html
│   ├── siem-avance.html
│   ├── statistiques-globales.html
│   ├── statistiques-staff.html
│   ├── calendrier-admin.html
│   └── calendrier-utilisateur.html
│
├── serveur.js                  # Point d'entrée principal de l'application
├── package.json                # Dépendances Node.js
├── architecture.md             # Ce document de référence
└── .env                        # Variables d'environnement (secrets)
```

---

## 📂 Détail Complet Fichier par Fichier

---

### ⚙️ Racine du Projet

| Fichier | Rôle |
|---|---|
| `serveur.js` | Fichier principal. Charge Express, initialise les routes, les middlewares globaux (Helmet, CORS, sessions), la connexion DB et démarre l'écoute HTTP sur le port défini dans `.env`. |
| `.env` | Contient toutes les variables confidentielles : `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `PORT`. Ne doit jamais être versionné. |
| `package.json` | Déclare les dépendances NPM du projet : `express`, `pg`, `bcrypt`, `pdfkit`, `xlsx`, `qrcode`, etc. |
| `architecture.md` | Ce fichier de documentation décrivant toute l'arborescence et le rôle de chaque composant. |
| `architecture.pdf` | Version PDF imprimable de ce document. |

---

### ⚙️ `config/`

| Fichier | Rôle |
|---|---|
| `db.js` | Configure et exporte le **Pool de connexions PostgreSQL** via la librairie `pg`. Toutes les requêtes SQL du projet passent par ce fichier. Gère également la reconnexion automatique en cas de perte de connexion. |

---

### 🛣️ `routes/` — Les Endpoints API

| Fichier | Rôle |
|---|---|
| `routesAuth.js` | Expose `/api/auth/login` et `/api/auth/logout`. Délègue la vérification au `controleurAuth.js`. Protège la déconnexion via session. |
| `routesPubliques.js` | Expose les routes sans authentification : connexion, page d'accueil, participation publique via QR code. |
| `routesCoordination.js` | CRUD complet pour les coordinations (création, édition, suppression, ajout de membres). |
| `routesSecurite.js` | Routes liées à la sécurité avancée : journaux d'accès, IPs bloquées, événements suspects, SIEM. |
| `routesStats.js` | Expose les endpoints de statistiques globales utilisées par le tableau de bord (`/api/stats`). |
| `routesUtilisateur.js` | Gestion des comptes utilisateurs : création, modification, suppression dure, changement de mot de passe, upload photo. |
| `staffRoutes.js` | Routes exclusives au profil **Staff** : liste des présences financières CCMS, mise à jour du statut de validation, export de données, rapport PDF d'émargement. |

---

### 🧠 `controleurs/` — La Logique Métier

| Fichier | Rôle |
|---|---|
| `controleurAuth.js` | Vérifie l'identité de l'utilisateur (login + hash bcrypt), enregistre l'empreinte du navigateur (FingerprintJS), génère le jeton JWT et persiste la session. |
| `controleurBI.js` | Business Intelligence. Calcule et renvoie les KPI du tableau de bord : nombre de réunions, présences, taux de participation, statistiques par mois. |
| `controleurCalendrier.js` | Fournit la liste des réunions formatée pour l'affichage dans les calendriers FullCalendar (admin et utilisateur). |
| `controleurCoordination.js` | Gère la création, la récupération et la mise à jour des entités de coordination (groupes de réunions liées). |
| `controleurReunion.js` | Cœur de la gestion des réunions : création avec validation du type (CODIRE, CCMS, etc.), génération OTP, ouverture/fermeture, gestion des participants. |
| `controleurSecurite.js` | Gère les journaux d'événements de sécurité, la détection d'intrusion basique, et les blocages d'IP. |
| `controleurSiemAvance.js` | Module SIEM avancé : corrélation d'événements, alertes de comportements anormaux, tableau des menaces actives. |
| `controleurStaffStats.js` | Statistiques spécifiques au rôle Staff : nombre de réunions gérées, taux de validation financière, historique. |
| `controleurUtilisateur.js` | CRUD complet des profils utilisateurs : création avec hash du mot de passe, modification du rôle, soft-delete, gestion de la photo de profil. |

---

### 🔒 `middlewares/` — Les Filtres de Sécurité

| Fichier | Rôle |
|---|---|
| `middlewareAuth.js` | Vérifie systématiquement la validité du **Token JWT** dans chaque requête protégée. Rejette les accès non autorisés avec un `401`. Supporte aussi la vérification par rôle (RBAC). |
| `securite.js` | Applique le **rate-limiting** par IP, détecte les attaques brute-force, et enregistre les tentatives suspectes en base de données. |
| `barreLateraleDynamique.js` | Middleware qui injecte dans chaque réponse les données nécessaires à l'affichage dynamique de la barre latérale (menu selon rôle). |
| `elementsBarreLaterale.js` | Contient la liste exhaustive des éléments de navigation par rôle utilisateur (admin, staff, user, super_admin). |
| `edr.js` | Module de détection et de réponse aux endpoints (EDR léger) : surveille les patterns de requêtes anormaux. |

---

### 🌐 `public/css/` — Les Feuilles de Style

| Fichier | Rôle |
|---|---|
| `theme.css` | Système de **thèmes dynamiques** (vert, orange, bleu). Définit les variables CSS globales (`--primary`, `--bg-body`, etc.). Utilisé sur toutes les pages. |
| `sidebar.css` | Styles de la barre de navigation latérale partagée entre toutes les vues authentifiées (largeur, animations, collapse mobile). |
| `dashboard-staff.css` | Styles spécifiques au tableau de bord du rôle Staff : cartes KPI, tableaux de présence, badges de statut financier. |
| `stats-staff.css` | Styles pour la page de statistiques Staff : graphiques en barres, indicateurs de performance. |

---

### 📜 `public/js/` — Les Scripts JavaScript Client

| Fichier | Rôle |
|---|---|
| `theme.js` | Gère le basculement de thème couleur en temps réel (vert/orange/bleu). Persiste le choix dans `localStorage` et émet un événement `themeChanged`. Chargé en priorité dans le `<head>` de chaque page. |
| `toast.js` | Bibliothèque interne de **notifications flottantes** (toasts). Expose `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`. Utilisé sur toutes les pages. |
| `dashboard-logic.js` | Logique du tableau de bord admin : récupère les KPI depuis l'API, alimente les graphiques Chart.js (barres, courbes), et anime les compteurs dynamiques. |
| `dashboard-staff.js` | Logique du tableau de bord Staff : affiche les réunions à valider, les présences en attente et les alertes financières CCMS. |
| `realtime-dashboard.js` | Met à jour les données du tableau de bord en temps réel via des appels API périodiques (polling toutes les 30 secondes). |
| `script-participation.js` | Gère la page de participation publique via QR Code : récupère les données de la réunion, capture la géolocalisation, soumet la présence via l'API. |
| `script-admin-calendar.js` | Initialise et configure le calendrier **FullCalendar** côté admin : affiche toutes les réunions, gère les clics, les couleurs par type, et les créations rapides. |
| `script-calendar.js` | Calendrier côté utilisateur : affiche uniquement les réunions auxquelles l'utilisateur a accès. |
| `live-search.js` | Moteur de **recherche en temps réel** : filtre les tableaux HTML au fur et à mesure de la saisie sans rechargement de page. |
| `fingerprint.js` | Intègre **FingerprintJS** : calcule une empreinte unique du navigateur utilisateur et l'envoie lors de la connexion pour détecter les connexions depuis un nouvel appareil. |
| `profile-dropdown.js` | Gère le menu déroulant du profil en haut à droite : affiche le nom, le rôle, la photo de l'utilisateur connecté depuis `sessionStorage`. |
| `smart_greeting.js` | Génère un message de bienvenue contextuel selon l'heure de la journée ("Bonjour", "Bonsoir") et le prénom de l'utilisateur. |
| `stats-staff.js` | Alimente la page de statistiques Staff avec des graphiques basés sur les données de participation et de validation financière. |
| `utils.js` | Fonctions utilitaires partagées côté client : formatage de dates, formatage monétaire FCFA, troncature de textes longs. |

---

### 🖥️ `views/` — Les Pages HTML

#### Authentification
| Fichier | Rôle |
|---|---|
| `connexion.html` | Page de **login**. Interface avec avatar animé (Homme/Femme selon le genre sélectionné), cartes flottantes décoratives, bascule de thème. Envoie les credentials à `/api/auth/login` et redirige selon le rôle reçu. |

#### Tableaux de Bord
| Fichier | Rôle |
|---|---|
| `tableau-de-bord-admin.html` | Tableau de bord principal pour les rôles **Admin et Coordinateur**. Affiche les KPI (réunions actives, participants, taux) via des graphiques Chart.js et alimente les compteurs en temps réel. |
| `tableau-de-bord.html` | Version simplifiée du tableau de bord pour les **utilisateurs standard** : calendrier des prochaines réunions et historique de présence. |

#### Gestion des Réunions
| Fichier | Rôle |
|---|---|
| `nouvelle-reunion-admin.html` | Formulaire complet de **création de réunion** pour les administrateurs : titre, type (CODIRE, CCMS, Partenaire...), date, lieu, couleur, impact financier, QR code automatique. |
| `nouvelle-reunion-utilisateur.html` | Formulaire de création de réunion pour les utilisateurs ayant le droit de créer (ex : Partenaire Externe). Version simplifiée du formulaire admin. |
| `liens-reunion.html` | Page affichant les **liens de participation** générés pour une réunion (QR Code, lien direct). Réservée aux administrateurs. |
| `liens-reunion-utilisateur.html` | Même chose que ci-dessus mais pour les utilisateurs créateurs de réunions Partenaire Externe. |
| `lobby-reunion.html` | Salle d'attente affichée aux participants avant l'ouverture officielle de la réunion. Affiche un compte à rebours et le statut en temps réel. |
| `reunion-terminee.html` | Page de confirmation affichée à l'issue d'une réunion (participation enregistrée avec succès). |
| `qr-reunion.html` | Affiche le **QR Code de participation** à projeter en salle. Se rafraîchit automatiquement toutes les 30 secondes selon la configuration. |

#### Participation
| Fichier | Rôle |
|---|---|
| `participation.html` | Page de **pointage public** (sans authentification) accessible via QR Code ou lien direct. Capture la géolocalisation et enregistre la présence. |
| `participation-utilisateur.html` | Vue de participation pour les utilisateurs internes : liste leurs présences passées, affiche le statut de validation. |
| `participation-interne.html` | Interface admin de gestion des présences à une réunion : liste les participants, permet leur validation manuelle, affiche les signatures. |
| `formulaire-interne.html` | Formulaire de participation manuelle (saisie au nom d'un absent, participation forcée par l'administrateur). |

#### Gestion des Utilisateurs et Coordinations
| Fichier | Rôle |
|---|---|
| `gestion-utilisateurs.html` | Backoffice complet de gestion des comptes : création, édition, changement de rôle, désactivation (soft-delete), upload de photo de profil. |
| `gestion-coordinations.html` | Gestion des **entités de coordination** (groupes thématiques de réunions) : création, ajout/retrait de membres, archivage. |
| `nouvelle-coordination.html` | Formulaire de création d'une nouvelle coordination avec définition des membres et du sigle. |
| `gestion-experience.html` | Gestion des fiches d'expérience et de compétences des membres. Module RH complémentaire. |

#### Finance & Staff (CCMS)
| Fichier | Rôle |
|---|---|
| `gestion-staff.html` | Page centrale du module **Validation Financière CCMS**. Permet au staff de : sélectionner une réunion, filtrer les participants par montant, valider les présences (case Statut Staff), et exporter la **liste d'émargement Excel** au format officiel CCMS 2026. |
| `statistiques-staff.html` | Statistiques spécifiques au rôle Staff : graphiques de réunions gérées, taux de validation, historique financier. |

#### Calendriers
| Fichier | Rôle |
|---|---|
| `calendrier-admin.html` | Vue calendrier **FullCalendar** pour les administrateurs : toutes les réunions, filtrage par type, création rapide au clic. |
| `calendrier-utilisateur.html` | Vue calendrier pour les utilisateurs standard : affiche uniquement les réunions les concernant. |

#### Sécurité & Journaux
| Fichier | Rôle |
|---|---|
| `historique-journaux.html` | Historique complet des **journaux d'activité** : connexions, déconnexions, créations/suppressions d'entités, avec filtrage par date et utilisateur. |
| `logs-securite.html` | Tableau de bord de sécurité : tentatives de connexion échouées, IPs suspectes, événements de sécurité classés par niveau de risque. |
| `siem-avance.html` | Interface SIEM avancée : corrélation d'alertes, graphiques de menaces en temps réel, exportation des logs. |

#### Statistiques
| Fichier | Rôle |
|---|---|
| `statistiques-globales.html` | Vue statistique complète : réunions par mois, types de réunions, taux de présence globaux, graphiques comparatifs. |

---

### 🛠️ `utilitaires/` — Les Services Techniques

| Fichier | Rôle |
|---|---|
| `generateurPdf.js` | Génère les **rapports PDF d'émargement** à la volée : injecte les présences validées, dessine le tableau avec les signatures, retourne un flux de données prêt à télécharger via `pdfkit`. |
| `journaliseur.js` | Service de **journalisation centralisé** : écrit dans `logs/server.log` tout événement système (erreur, requête, connexion), avec horodatage et niveau de criticité. |
| `serviceSecurite.js` | Fournit les outils de sécurité : génération et vérification de **tokens JWT**, hashage des mots de passe via `bcrypt`, génération d'OTP temporaires. |
| `validateurs.js` | Schémas de **validation des données entrantes** via la librairie `Joi` : vérifie le format des emails, la longueur des mots de passe, et la complétude des formulaires avant traitement. |

---

### 🗄️ `database/` — Schéma de Référence

> **Note de nettoyage (13 Avril 2026)** : Toutes les migrations ont été appliquées à la base de données de production. Les fichiers SQL de migration ont été **archivés dans `backups/migrations/`** pour alléger le projet. Le dossier `database/` ne contient désormais que le schéma de référence.

| Fichier | Rôle |
|---|---|
| `schema.sql` | Schéma SQL complet et à jour. Contient la définition de toutes les tables (`users`, `meetings`, `attendees`, `coordinations`, `security_events`, etc.), les extensions (`uuid-ossp`), et les index de performance. **À utiliser pour une installation fraîche du système.** |

---

### 📦 `backups/migrations/` — Historique des Migrations (Archivées)

Ces fichiers ont tous été **appliqués en production**. Ils sont conservés uniquement à titre d'historique et de documentation. Ils ne doivent **jamais être ré-exécutés** sur une base existante.

| Fichier | Ce qu'il a fait | Impact sur la BD |
|---|---|---|
| `add_financial_impact.sql` | Ajout de la colonne `financial_impact BOOLEAN DEFAULT false` à la table `meetings`. Permet de distinguer les réunions avec incidence budgétaire (émargement CCMS). | Table `meetings` |
| `add_meeting_fields.sql` | Ajout de `meeting_type` (intra/externe), `meeting_category`, `priority` (haute/normale), `geo_lat`, `geo_lon`, `geo_radius` pour la géolocalisation de présence, `token_refresh_interval`. | Table `meetings` |
| `add_soft_delete.sql` | Ajout de la colonne `deleted_at TIMESTAMP NULL` sur `meetings`, `users` et `coordinations`. Permet la suppression douce : les entités sont masquées mais non effacées physiquement. | Tables `meetings`, `users`, `coordinations` |
| `add_teams_hierarchy.sql` | Mise en place de la hiérarchie d'équipes pour les coordinations multi-niveaux. Ajout d'un référencement parent-enfant entre coordinations. | Table `coordinations` |
| `add_experience_fields.sql` | Ajout des champs de compétences et d'expérience professionnelle sur les profils utilisateurs (`experience`, `skills`, `biography`). | Table `users` |
| `add_sigle_coordination.sql` | Ajout de la colonne `sigle_coordination VARCHAR(50)` à la table `coordinations` pour les abréviations officielles (ex : CCMS, CGEN). | Table `coordinations` |
| `add_statistics_index.sql` | Création d'un index composite sur `attendees(email, nom, prenom)` pour accélérer les requêtes statistiques de dédoublonnage de participants. | Index sur `attendees` |
| `create_security_tables.sql` | Création des tables de sécurité : `security_events` (journal SIEM), `blocked_ips` (liste noire), `browser_fingerprints` (empreintes connues). | Nouvelles tables |
| `fix_meetings_schema.sql` | Refactoring majeur : conversion du type de la clé primaire `meetings.id` de `UUID` vers `INTEGER SERIAL`. Migration complète des données avec table intermédiaire et remappings des clés étrangères dans `attendees` et `agenda_items`. | Tables `meetings`, `attendees`, `agenda_items` |
| `nouveau_paradigme_securite.sql` | Création des tables Zero Trust : `participants_uniques` (identité email), `appareils_connus` (fingerprints par utilisateur, quota 4 appareils via trigger), `sessions_actives` (UUID de session), `journal_securite` (SIEM JSONB), `emargements_securises` (hash d'intégrité). | Nouvelles tables + trigger PostgreSQL |
| `remove_impact_level.sql` | Suppression de la colonne `impact_level` de la table `meetings`, rendue obsolète après la refonte du module financier CCMS. | Table `meetings` |
| `vider_tables.sql` | ⚠️ Script de remise à zéro des données : vide les tables de données (participants, présences, réunions) tout en préservant les comptes utilisateurs. **À n'utiliser qu'avant un déploiement en production vierge.** | Toutes tables de données |
| `run_soft_delete_migration.js` | Script Node.js alternatif pour la migration soft-delete : exécute les `ALTER TABLE` via le pool de connexion Node, crée les index simples et composites sur `deleted_at`. Utilisé quand l'accès direct à `psql` n'était pas disponible. | Tables `meetings`, `users`, `coordinations` |

---

## 🔗 Flux d'Intégration Complet

```text
Navigateur (HTML/CSS/JS)
        │
        │  HTTP Request
        ▼
serveur.js  ──► middlewares/ (JWT, Rate-Limit, Sécurité)
        │
        ▼
routes/  (routesAuth.js, staffRoutes.js, ...)
        │
        ▼
controleurs/ (controleurReunion.js, controleurAuth.js, ...)
        │
        ▼
config/db.js ──► Base de données PostgreSQL
        │
        ▼
utilitaires/ (PDF, emails, cryptographie)
        │
        ▼
Réponse JSON/PDF/HTML ──► Navigateur
```

---

> **Note** : Ce document a été généré automatiquement à partir de l'analyse complète du dépôt source le **13 Avril 2026**. Il doit être mis à jour à chaque ajout de fichier significatif.
