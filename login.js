document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';
    const form = document.getElementById('loginForm');
    const message = document.getElementById('loginMessage');
    const button = document.getElementById('loginButton');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        button.disabled = true; button.textContent = 'Checking…';
        const data = new URLSearchParams({ action: 'login', Name: document.getElementById('staffName').value.trim(), PIN: document.getElementById('staffPin').value });
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: data });
            const result = await response.json();
            if (result.status !== 'success' || !result.user) throw new Error(result.message || 'Invalid name or PIN.');
            localStorage.setItem('ganesh_staff_user', JSON.stringify(result.user));
            window.location.href = new URLSearchParams(window.location.search).get('returnTo') || 'staff-dashboard.html';
        } catch (error) {
            message.textContent = error.message || 'Login failed. Please try again.'; message.className = 'form-message error';
            button.disabled = false; button.textContent = 'Login';
        }
    });
});
