/**
 * Composant de recherche en direct - OSEP
 * Fournit un filtrage instantané avec bouton de réinitialisation
 */

class LiveSearch {
    constructor(inputSelector, targetSelector, options = {}) {
        this.input = document.querySelector(inputSelector);
        this.targetContainer = document.querySelector(targetSelector);
        this.options = {
            searchKeys: options.searchKeys || ['textContent'], // Clés dans lesquelles chercher
            debounceMs: options.debounceMs || 150, // Délai d'anti-rebond (debounce)
            caseSensitive: options.caseSensitive || false,
            highlightMatches: options.highlightMatches || true,
            onFilter: options.onFilter || null, // Rappel après le filtrage
            itemSelector: options.itemSelector || null, // Sélecteur d'élément spécifique
            ...options
        };

        this.allItems = [];
        this.debounceTimer = null;
        this.clearButton = null;

        this.init();
    }

    init() {
        if (!this.input || !this.targetContainer) {
            console.error('LiveSearch: Input or target container not found');
            return;
        }

        // Ajouter le bouton d'effacement
        this.addClearButton();

        // Stocker tous les éléments
        this.refreshItems();

        // Attacher les écouteurs d'événements
        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') this.clear();
        });

        // Clic sur le bouton d'effacement
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clear());
        }
    }

    addClearButton() {
        // Vérifier si le parent a une position relative/absolue
        const parent = this.input.parentElement;
        const parentStyle = window.getComputedStyle(parent);

        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        // Créer le bouton d'effacement
        this.clearButton = document.createElement('button');
        this.clearButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        this.clearButton.className = 'search-clear-btn';
        this.clearButton.type = 'button';
        this.clearButton.title = 'Effacer la recherche';
        this.clearButton.style.cssText = `
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: #999;
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            opacity: 0;
            pointer-events: none;
            transition: all 0.2s ease;
            z-index: 10;
        `;

        parent.appendChild(this.clearButton);

        // Afficher/masquer en fonction de la valeur de saisie
        this.updateClearButton();
    }

    updateClearButton() {
        if (!this.clearButton) return;

        if (this.input.value.trim().length > 0) {
            this.clearButton.style.opacity = '1';
            this.clearButton.style.pointerEvents = 'auto';
        } else {
            this.clearButton.style.opacity = '0';
            this.clearButton.style.pointerEvents = 'none';
        }
    }

    refreshItems() {
        if (this.options.itemSelector) {
            this.allItems = Array.from(this.targetContainer.querySelectorAll(this.options.itemSelector));
        } else {
            this.allItems = Array.from(this.targetContainer.children);
        }
    }

    handleInput(e) {
        this.updateClearButton();

        // Anti-rebond (debounce) pour la performance
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.filter(e.target.value);
        }, this.options.debounceMs);
    }

    filter(query) {
        const searchTerm = this.options.caseSensitive ? query : query.toLowerCase();
        let visibleCount = 0;

        this.allItems.forEach(item => {
            let matches = false;

            // Check if item matches search
            if (searchTerm.trim() === '') {
                matches = true;
            } else {
                // Chercher dans les clés spécifiées
                for (const key of this.options.searchKeys) {
                    let value = '';

                    if (key === 'textContent') {
                        value = item.textContent;
                    } else if (key.startsWith('data-')) {
                        value = item.getAttribute(key) || '';
                    } else {
                        value = item[key] || '';
                    }

                    if (!this.options.caseSensitive) {
                        value = value.toLowerCase();
                    }

                    if (value.includes(searchTerm)) {
                        matches = true;
                        break;
                    }
                }
            }

            // Afficher/masquer avec animation - FIXATION CRITIQUE
            if (matches) {
                item.style.removeProperty('display');
                item.style.animation = 'fadeIn 0.3s ease';
                item.style.visibility = 'visible';
                item.style.opacity = '1';
                item.style.height = 'auto';
                visibleCount++;
            } else {
                // Forcer le masquage avec plusieurs propriétés pour écraser tout CSS
                item.style.display = 'none !important';
                item.style.visibility = 'hidden';
                item.style.opacity = '0';
                item.style.height = '0';
                item.style.overflow = 'hidden';
            }
        });

        // Ajouter le message "Aucun résultat" si nécessaire
        this.handleNoResults(visibleCount);

        // Rappel
        if (this.options.onFilter) {
            this.options.onFilter(searchTerm, visibleCount);
        }
    }

    handleNoResults(count) {
        let noResultsEl = this.targetContainer.querySelector('.no-search-results');

        if (count === 0 && this.input.value.trim().length > 0) {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.className = 'no-search-results';
                noResultsEl.style.cssText = `
                    text-align: center;
                    padding: 60px 20px;
                    color: #999;
                    font-style: italic;
                    background: white;
                    border-radius: 12px;
                    margin: 20px 0;
                    grid-column: 1 / -1;
                    width: 100%;
                    box-sizing: border-box;
                `;
                noResultsEl.innerHTML = `
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.2; display: block;"></i>
                    <p style="margin: 0; font-size: 1.1rem; color: #666;">Aucun résultat trouvé pour "<strong style="color: var(--primary);">${this.escapeHtml(this.input.value)}</strong>"</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #999;">Essayez un autre terme de recherche</p>
                `;
                this.targetContainer.appendChild(noResultsEl);
            }
        } else if (noResultsEl) {
            noResultsEl.remove();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clear() {
        this.input.value = '';
        this.updateClearButton();
        this.filter('');
        this.input.focus();
    }

    destroy() {
        if (this.clearButton) {
            this.clearButton.remove();
        }
        clearTimeout(this.debounceTimer);
    }
}

// Ajouter l'animation fadeIn
if (!document.querySelector('#liveSearchStyles')) {
    const style = document.createElement('style');
    style.id = 'liveSearchStyles';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .search-clear-btn:hover {
            color: #ef4444 !important;
            background: rgba(239, 68, 68, 0.1) !important;
        }
    `;
    document.head.appendChild(style);
}

// Exporter pour utilisation
window.LiveSearch = LiveSearch;
