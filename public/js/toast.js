const toast = {
    show: function (message, type = 'info') {
        const div = document.createElement('div');
        div.textContent = message;
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.right = '20px';
        div.style.padding = '10px 20px';
        div.style.borderRadius = '5px';
        div.style.color = '#fff';
        div.style.zIndex = '10000';
        div.style.fontFamily = 'Arial, sans-serif';
        div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        div.style.transition = 'opacity 0.5s';

        if (type === 'success') div.style.backgroundColor = '#28a745';
        else if (type === 'error') div.style.backgroundColor = '#dc3545';
        else if (type === 'warning') div.style.backgroundColor = '#ffc107';
        else div.style.backgroundColor = '#17a2b8';

        document.body.appendChild(div);

        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 500);
        }, 3000);
    },
    success: function (msg) { this.show(msg, 'success'); },
    error: function (msg) { this.show(msg, 'error'); },
    warning: function (msg) { this.show(msg, 'warning'); },
    info: function (msg) { this.show(msg, 'info'); }
};

// Expose legacy showToast function globally
window.showToast = function (message, type) {
    toast.show(message, type);
};
