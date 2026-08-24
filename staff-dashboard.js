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

    const todaySpendTotal = document.getElementById('todaySpendTotal');
    const pendingChandaTotal = document.getElementById('pendingChandaTotal');
    const pendingLadduTotal = document.getElementById('pendingLadduTotal');
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';

    const money = value => Number(String(value || '').replace(/[^0-9.]/g, '')) || 0;
    const formatCurrency = value => `₹${value.toLocaleString('en-IN')}`;
    const today = new Date().toISOString().slice(0, 10);

    function matchesToday(value) {
        const text = String(value || '').trim();
        if (!text) return false;
        if (text.includes('-')) return text.slice(0, 10) === today;
        const dt = new Date(text);
        return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === today;
    }

    function normalizeHeaders(headers) {
        return headers.map(header => String(header || '').trim().toLowerCase());
    }

    function toRowObject(headers, row) {
        return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
    }

    async function loadSummary() {
        try {
            const [chandaResponse, ladduResponse, spendsResponse] = await Promise.all([
                fetch(GOOGLE_SCRIPT_URL),
                fetch(`${GOOGLE_SCRIPT_URL}?action=getLadduAuction`),
                fetch(`${GOOGLE_SCRIPT_URL}?action=getSpends`)
            ]);

            const chandaData = await chandaResponse.json();
            const ladduData = await ladduResponse.json();
            const spendsData = await spendsResponse.json();

            let pendingChanda = 0;
            if (chandaData.status === 'success' && Array.isArray(chandaData.data) && chandaData.data.length > 1) {
                const headers = normalizeHeaders(chandaData.data[0]);
                const records = chandaData.data.slice(1).map(row => toRowObject(headers, row));
                pendingChanda = records.reduce((sum, row) => {
                    const status = String(row['payment status'] || '').toLowerCase();
                    const amount = money(row['amount']);
                    const collected = money(row['amount collected']);
                    const pendingAmount = Math.max(amount - collected, 0);
                    return sum + (status === 'pending' ? pendingAmount : 0);
                }, 0);
            }

            let pendingLaddu = 0;
            if (ladduData.status === 'success' && Array.isArray(ladduData.data) && ladduData.data.length > 1) {
                const headers = normalizeHeaders(ladduData.data[0]);
                const records = ladduData.data.slice(1).map(row => toRowObject(headers, row));
                pendingLaddu = records.reduce((sum, row) => {
                    const amount = money(row['laddu amount'] || row['auction amount'] || row['total laddu amount'] || row['total amount']);
                    const collected = money(row['amount collected'] || row['collected amount'] || row['paid amount'] || row['amount paid']);
                    return sum + Math.max(amount - collected, 0);
                }, 0);
            }

            let todaySpend = 0;
            if (spendsData.status === 'success' && Array.isArray(spendsData.data) && spendsData.data.length > 1) {
                const headers = normalizeHeaders(spendsData.data[0]);
                const records = spendsData.data.slice(1).map(row => toRowObject(headers, row));
                todaySpend = records.reduce((sum, row) => {
                    const amount = money(row['amount']);
                    return sum + (matchesToday(row['date']) ? amount : 0);
                }, 0);
            }

            if (todaySpendTotal) todaySpendTotal.textContent = formatCurrency(todaySpend);
            if (pendingChandaTotal) pendingChandaTotal.textContent = formatCurrency(pendingChanda);
            if (pendingLadduTotal) pendingLadduTotal.textContent = formatCurrency(pendingLaddu);
        } catch (error) {
            if (todaySpendTotal) todaySpendTotal.textContent = '—';
            if (pendingChandaTotal) pendingChandaTotal.textContent = '—';
            if (pendingLadduTotal) pendingLadduTotal.textContent = '—';
        }
    }

    loadSummary();
});
