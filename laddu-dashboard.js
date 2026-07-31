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
    const loader = document.getElementById('ladduLoader');
    const summary = document.getElementById('ladduSummary');
    const filters = document.getElementById('ladduFilters');
    const recordsEl = document.getElementById('ladduRecords');
    const searchInput = document.getElementById('ladduSearch');
    const statusFilter = document.getElementById('ladduStatus');
    const yearFilter = document.getElementById('ladduYear');
    let records = [];

    function value(record, keys) {
        const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(record, candidate));
        return key ? record[key] : '';
    }

    function amount(record, keys) {
        return Number(String(value(record, keys)).replace(/[^0-9.]/g, '')) || 0;
    }

    function dateYear(input) {
        const text = String(input || '').trim();
        const nativeDate = new Date(text);
        if (!Number.isNaN(nativeDate.getTime())) return String(nativeDate.getFullYear());
        const match = text.match(/(?:\d{1,2})\/(?:\d{1,2})\/(\d{4})/);
        return match ? match[1] : '';
    }

    function format(value) { return `₹${value.toLocaleString('en-IN')}`; }

    function setYears() {
        const active = yearFilter.value;
        const defaultYear = String(new Date().getFullYear() - 1);
        const years = [...new Set([...records.map(record => dateYear(value(record, ['timestamp', 'date']))).filter(Boolean), defaultYear])].sort((a, b) => b.localeCompare(a));
        yearFilter.innerHTML = '<option value="All">All Years</option>';
        years.forEach(year => yearFilter.add(new Option(year, year)));
        yearFilter.value = active !== 'All' && years.includes(active) ? active : defaultYear;
    }

    function render() {
        const term = searchInput.value.trim().toLowerCase();
        const selectedYear = yearFilter.value;
        const status = statusFilter.value;
        const filtered = records.filter(record => {
            const total = amount(record, ['laddu amount', 'auction amount', 'total laddu amount', 'total amount']);
            const collected = amount(record, ['amount collected', 'collected amount', 'paid amount', 'amount paid']);
            const isPaid = collected >= total && total > 0;
            const name = String(value(record, ['name', 'devotee name', 'auction winner', 'winner name'])).toLowerCase();
            const phone = String(value(record, ['whatsapp number', 'mobile number', 'phone', 'mobile'])).toLowerCase();
            return (status === 'All' || (status === 'Paid' ? isPaid : !isPaid)) &&
                (selectedYear === 'All' || dateYear(value(record, ['timestamp', 'date'])) === selectedYear) &&
                (!term || name.includes(term) || phone.includes(term));
        });

        const summaryRecords = records.filter(record => selectedYear === 'All' || dateYear(value(record, ['timestamp', 'date'])) === selectedYear);
        const auctionTotal = summaryRecords.reduce((sum, record) => sum + amount(record, ['laddu amount', 'auction amount', 'total laddu amount', 'total amount']), 0);
        const collectedTotal = summaryRecords.reduce((sum, record) => sum + amount(record, ['amount collected', 'collected amount', 'paid amount', 'amount paid']), 0);
        const pending = summaryRecords.filter(record => amount(record, ['amount collected', 'collected amount', 'paid amount', 'amount paid']) < amount(record, ['laddu amount', 'auction amount', 'total laddu amount', 'total amount']));
        document.getElementById('ladduPendingTotal').textContent = format(Math.max(auctionTotal - collectedTotal, 0));
        document.getElementById('ladduAuctionTotal').textContent = format(auctionTotal);
        document.getElementById('ladduCollectedTotal').textContent = format(collectedTotal);
        document.getElementById('ladduPendingCount').textContent = pending.length;
        document.getElementById('ladduYearLabel').textContent = selectedYear === 'All' ? '(All Years)' : `(${selectedYear})`;

        recordsEl.innerHTML = '';
        if (!records.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-pending-state';
            empty.textContent = 'No data found.';
            recordsEl.appendChild(empty);
            return;
        }
        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-pending-state';
            empty.textContent = 'No data found.';
            recordsEl.appendChild(empty);
            return;
        }

        filtered.forEach(record => {
            const name = value(record, ['name', 'devotee name', 'auction winner', 'winner name']) || 'Auction winner';
            const phone = value(record, ['whatsapp number', 'mobile number', 'phone', 'mobile']);
            const total = amount(record, ['laddu amount', 'auction amount', 'total laddu amount', 'total amount']);
            const collected = amount(record, ['amount collected', 'collected amount', 'paid amount', 'amount paid']);
            const balance = Math.max(total - collected, 0);
            const card = document.createElement('article');
            card.className = 'pending-laddu-card';
            const title = document.createElement('h3'); title.textContent = name;
            const phoneText = document.createElement('p'); phoneText.textContent = phone;
            const amounts = document.createElement('div');
            amounts.className = 'pending-laddu-amounts';
            amounts.innerHTML = `<span>Total ${format(total)}</span><span>Collected ${format(collected)}</span><strong>${balance ? `Due ${format(balance)}` : 'Fully Paid'}</strong>`;
            card.append(title, phoneText, amounts);

            const actions = document.createElement('div');
            actions.className = 'pending-laddu-actions';

            const notify = document.createElement('button');
            notify.type = 'button';
            notify.className = 'action-btn secondary-action';
            notify.textContent = 'Notify';
            notify.addEventListener('click', () => {
                const notifyMessage = `Namaskaram ${name} garu,\n\nCongratulations on winning the Ganesh Laddu auction for ${format(total)}. Your winner details have been recorded successfully. Please visit the collection desk to complete the remaining payment.\n\nMay Lord Ganesha bless you with happiness, prosperity, and peace. 🙏\n\nGanapati Bappa Morya!\n\nThanks & Regards \n Sikhwada Youth Association`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(notifyMessage)}`, '_blank');
            });
            actions.appendChild(notify);

            if (balance > 0) {
                const collect = document.createElement('a');
                collect.className = 'action-btn';
                const recordYear = dateYear(value(record, ['timestamp', 'date']));
                collect.href = `laddu-collection.html?phone=${encodeURIComponent(phone)}${recordYear ? `&year=${encodeURIComponent(recordYear)}` : ''}`;
                collect.textContent = 'Collect Now';
                actions.appendChild(collect);
            }
            card.appendChild(actions);
            recordsEl.appendChild(card);
        });
    }

    async function load() {
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getLadduAuction`);
            const data = await response.json();
            if (data.status !== 'success' || !Array.isArray(data.data)) throw new Error('Invalid Laddu data');
            const headers = data.data[0].map(header => String(header || '').trim().toLowerCase());
            records = data.data.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
            setYears();
            loader.style.display = 'none';
            summary.style.display = 'block';
            filters.style.display = 'flex';
            render();
        } catch (error) {
            loader.style.display = 'none';
            recordsEl.textContent = 'Failed to load Laddu records. Please ensure your Google Script is updated and redeployed.';
        }
    }

    searchInput.addEventListener('input', render);
    statusFilter.addEventListener('change', render);
    yearFilter.addEventListener('change', render);
    load();
});
