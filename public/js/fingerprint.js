/**
 * Bouclier OSEP - Système de Fingerprinting (EDR Client)
 * Génère une empreinte numérique unique pour l'appareil sans utiliser l'adresse MAC.
 */
const FingerprintOSEP = {
    /**
     * Collecte les données techniques de l'appareil
     */
    async obtenirDonnees() {
        const data = {
            ua: navigator.userAgent,
            lang: navigator.language,
            resolution: `${window.screen.width}x${window.screen.height}`,
            profondeur_couleur: window.screen.colorDepth,
            fuseau_horaire: Intl.DateTimeFormat().resolvedOptions().timeZone,
            plateforme: navigator.platform,
            memoire: navigator.deviceMemory || 'inconnue',
            coeurs: navigator.hardwareConcurrency || 'inconnu',
            canvas: this.genererHashCanvas()
        };
        return data;
    },

    /**
     * Génère un rendu canvas pour capturer les spécificités de la carte graphique
     */
    genererHashCanvas() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;

            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("OSEP-EDR-SECURITY", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("OSEP-EDR-SECURITY", 4, 17);

            return canvas.toDataURL();
        } catch (e) {
            return "canvas-blocked";
        }
    },

    /**
     * Génère le hash SHA-256 final de l'empreinte
     */
    async genererEmpreinte() {
        const data = await this.obtenirDonnees();
        const dataString = JSON.stringify(data);

        // Utilisation de l'API Web Crypto pour le hashage SHA-256
        const msgUint8 = new TextEncoder().encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return {
            hash: hashHex,
            metadonnees: data
        };
    },

    /**
     * Récupère la position GPS (si autorisée)
     */
    obtenirPosition() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ succes: false, erreur: 'GEOLOC_NOT_SUPPORTED' });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        succes: true,
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        precision: pos.coords.accuracy
                    });
                },
                (err) => {
                    resolve({ succes: false, erreur: 'GEOLOC_DENIED', code: err.code });
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    }
};

window.FingerprintOSEP = FingerprintOSEP;
