window.GaneshSuccessScreen = (() => {
    let overlay;

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'success-overlay';
        overlay.innerHTML = `
            <div class="success-card">
                <div class="success-icon">✓</div>
                <h2 id="successTitle">Success</h2>
                <p id="successMessage">Action completed successfully.</p>
                <button type="button" id="successCloseBtn" class="submit-btn success-close-btn">Close</button>
            </div>
        `;
        document.body.appendChild(overlay);
        const closeBtn = overlay.querySelector('#successCloseBtn');
        closeBtn.addEventListener('click', () => hide());
        overlay.addEventListener('click', event => {
            if (event.target === overlay) hide();
        });
        return overlay;
    }

    function show({ title = 'Success', message = 'Action completed successfully.', buttonText = 'Close' }) {
        const instance = ensureOverlay();
        instance.querySelector('#successTitle').textContent = title;
        instance.querySelector('#successMessage').textContent = message;
        const closeBtn = instance.querySelector('#successCloseBtn');
        closeBtn.textContent = buttonText;
        instance.classList.add('visible');
    }

    function hide() {
        if (!overlay) return;
        overlay.classList.remove('visible');
    }

    return { show, hide };
})();
