document.addEventListener('DOMContentLoaded', () => {
    if (!window.GaneshAuth?.requireLogin()) return;

    const user = window.GaneshAuth.user();
    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText && user?.name) {
        welcomeText.textContent = `Welcome back, ${user.name}.`;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', event => {
            event.preventDefault();
            window.GaneshAuth.signOut();
            window.location.href = 'login.html';
        });
    }
});
