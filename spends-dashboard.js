document.addEventListener('DOMContentLoaded', () => {
    if (!window.GaneshAuth?.requireLogin()) return;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', event => {
            event.preventDefault();
            window.GaneshAuth.signOut();
            window.location.href = 'login.html';
        });
    }

    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';
    const loader = document.getElementById('spendLoader');
    const table = document.getElementById('spendTable');
    const recordsEl = document.getElementById('spendRecords');
    const search = document.getElementById('spendSearch');
    const typeFilter = document.getElementById('spendTypeFilter');
    const yearFilter = document.getElementById('spendYearFilter');
    let records = [];

    const value = (record, key) => record[key] || '';
    const money = value => Number(String(value).replace(/[^0-9.]/g, '')) || 0;
    const year = value => { const match = String(value || '').match(/(\d{4})/); return match ? match[1] : ''; };
    const currency = value => `₹${value.toLocaleString('en-IN')}`;

    function render() {
        const term = search.value.toLowerCase().trim();
        const selectedType = typeFilter.value;
        const selectedYear = yearFilter.value;
        const filtered = records.filter(record =>
            (selectedType === 'All' || value(record, 'spend type') === selectedType) &&
            (selectedYear === 'All' || year(value(record, 'date')) === selectedYear) &&
            (!term || `${value(record, 'item / purpose')} ${value(record, 'notes')}`.toLowerCase().includes(term))
        );
        const total = filtered.reduce((sum, record) => sum + money(value(record, 'amount')), 0);
        document.getElementById('spendTotal').textContent = currency(total);
        document.getElementById('spendYearLabel').textContent = selectedYear === 'All' ? '(All Years)' : `(${selectedYear})`;
        recordsEl.innerHTML = '';
        if (!records.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6; cell.className = 'spend-empty-row'; cell.textContent = 'No data found.';
            row.appendChild(cell); recordsEl.appendChild(row); return;
        }
        if (!filtered.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6; cell.className = 'spend-empty-row'; cell.textContent = 'No data found.';
            row.appendChild(cell); recordsEl.appendChild(row); return;
        }
        filtered.sort((a, b) => String(value(b, 'date')).localeCompare(String(value(a, 'date')))).forEach(record => {
            const row = document.createElement('tr');
            const fields = [value(record, 'date'), value(record, 'spend type'), value(record, 'item / purpose'), value(record, 'notes') || '—'];
            fields.forEach((field, index) => {
                const cell = document.createElement('td'); cell.textContent = field;
                if (index === 1) cell.className = 'spend-type-cell';
                row.appendChild(cell);
            });
            const billCell = document.createElement('td');
            const billUrl = value(record, 'bill photo');
            if (billUrl) {
                const billLink = document.createElement('a'); billLink.href = billUrl; billLink.target = '_blank'; billLink.rel = 'noopener'; billLink.className = 'bill-link'; billLink.textContent = 'View Bill';
                billCell.appendChild(billLink);
            } else billCell.textContent = '—';
            const amountCell = document.createElement('td'); amountCell.className = 'spend-amount-cell'; amountCell.textContent = currency(money(value(record, 'amount')));
            row.append(billCell, amountCell); recordsEl.appendChild(row);
        });
    }

    async function load() {
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getSpends`);
            const data = await response.json();
            if (data.status !== 'success' || !Array.isArray(data.data)) throw new Error('Invalid spend data');
            const headers = data.data[0].map(header => String(header || '').trim().toLowerCase());
            records = data.data.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
            [...new Set(records.map(record => value(record, 'spend type')).filter(Boolean))].sort().forEach(type => typeFilter.add(new Option(type, type)));
            const defaultYear = String(new Date().getFullYear());
            [...new Set([...records.map(record => year(value(record, 'date'))).filter(Boolean), defaultYear])].sort((a,b) => b.localeCompare(a)).forEach(item => yearFilter.add(new Option(item, item)));
            yearFilter.value = defaultYear;
            loader.style.display = 'none'; table.style.display = 'table'; document.getElementById('spendSummary').style.display = 'block'; document.getElementById('spendFilters').style.display = 'flex'; render();
        } catch (error) { loader.style.display = 'none'; table.style.display = 'table'; const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 6; cell.className = 'spend-empty-row'; cell.textContent = 'Failed to load spends. Update and redeploy the Google Apps Script.'; row.appendChild(cell); recordsEl.appendChild(row); }
    }
    search.addEventListener('input', render); typeFilter.addEventListener('change', render); yearFilter.addEventListener('change', render); load();
});
