document.addEventListener('DOMContentLoaded', () => {
    // URL to your Google Apps Script Web App
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';

    const loader = document.getElementById('loader');
    const recordsTable = document.getElementById('recordsTable');
    const tableBody = document.getElementById('tableBody');
    const summaryCard = document.getElementById('summaryCard');
    const totalAmountEl = document.getElementById('totalAmount');
    const chandaAmountEl = document.getElementById('chandaAmount');
    const ladduCollectedAmountEl = document.getElementById('ladduCollectedAmount');
    const ladduAuctionAmountEl = document.getElementById('ladduAuctionAmount');
    const selectedYearLabel = document.getElementById('selectedYearLabel');
    
    // Filter elements
    const filterSection = document.getElementById('filterSection');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const yearFilter = document.getElementById('yearFilter');

    let allRows = [];
    let ladduRows = [];

    // Safely parse dates from Google Sheets which can come in various formats
    // e.g. "31/07/2026, 10:30:00" or "7/31/2026, 10:30:00 AM" or ISO strings
    function parseSheetDate(value) {
        if (!value) return null;

        // Already a JS Date object (when Apps Script returns a Date)
        if (value instanceof Date) return value;

        const str = String(value).trim();
        if (!str) return null;

        // Try native parse first (works for ISO and many formats)
        let d = new Date(str);
        if (!isNaN(d.getTime())) return d;

        // Handle DD/MM/YYYY or DD/MM/YYYY, HH:MM:SS (Indian locale format)
        const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (ddmmyyyy) {
            d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`);
            if (!isNaN(d.getTime())) return d;
        }

        return null;
    }

    function formatDate(value, includeYear = false) {
        const d = parseSheetDate(value);
        if (!d) return String(value || '-');
        const opts = { day: '2-digit', month: 'short' };
        if (includeYear) opts.year = 'numeric';
        return d.toLocaleDateString('en-IN', opts);
    }

    function yearFrom(value) {
        const date = parseSheetDate(value);
        return date ? String(date.getFullYear()) : '';
    }

    function valueFrom(record, keys) {
        const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(record, candidate));
        return key ? record[key] : '';
    }

    function toLadduRecords(data) {
        if (!Array.isArray(data) || data.length < 2) return [];
        const headers = data[0].map(header => String(header || '').trim().toLowerCase());
        return data.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
    }

    function refreshYearOptions() {
        const current = yearFilter.value;
        const years = new Set();
        allRows.forEach(item => { const year = yearFrom(item.row[0]); if (year) years.add(year); });
        ladduRows.forEach(row => { const year = yearFrom(valueFrom(row, ['timestamp', 'date'])); if (year) years.add(year); });
        yearFilter.innerHTML = '<option value="All">All Years</option>';
        [...years].sort((a, b) => b.localeCompare(a)).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });
        yearFilter.value = [...yearFilter.options].some(option => option.value === current) ? current : 'All';
    }

    function updateSummary(chandaRows) {
        const chandaTotal = chandaRows.reduce((total, item) => {
            return total + ((item.row[5] || 'Paid') === 'Paid' ? (parseFloat(item.row[3]) || 0) : 0);
        }, 0);
        const selectedYear = yearFilter.value;
        const selectedLadduRows = ladduRows.filter(row => selectedYear === 'All' || yearFrom(valueFrom(row, ['timestamp', 'date'])) === selectedYear);
        const ladduCollected = selectedLadduRows.reduce((total, row) => total + (parseFloat(valueFrom(row, ['amount collected', 'collected amount', 'paid amount', 'amount paid'])) || 0), 0);
        const ladduAuctionTotal = selectedLadduRows.reduce((total, row) => total + (parseFloat(valueFrom(row, ['laddu amount', 'auction amount', 'total laddu amount', 'total amount'])) || 0), 0);
        totalAmountEl.textContent = `₹${(chandaTotal + ladduCollected).toLocaleString('en-IN')}`;
        chandaAmountEl.textContent = `₹${chandaTotal.toLocaleString('en-IN')}`;
        ladduCollectedAmountEl.textContent = `₹${ladduCollected.toLocaleString('en-IN')}`;
        ladduAuctionAmountEl.textContent = `₹${ladduAuctionTotal.toLocaleString('en-IN')}`;
        selectedYearLabel.textContent = selectedYear === 'All' ? '(All Years)' : `(${selectedYear})`;
    }

    function renderTable(rowsToRender) {
        tableBody.innerHTML = '';

        // Also refresh mobile cards
        let cardsContainer = document.getElementById('mobileCards');
        if (!cardsContainer) {
            cardsContainer = document.createElement('div');
            cardsContainer.id = 'mobileCards';
            cardsContainer.className = 'record-cards';
            document.querySelector('.table-container').appendChild(cardsContainer);
        }
        cardsContainer.innerHTML = '';

        updateSummary(rowsToRender);

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No records match your search.</td></tr>';
            cardsContainer.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">No records match your search.</p>';
            return;
        }

        rowsToRender.forEach((item) => {
            const { row, index } = item;
            const rowNumber = index + 2;

            const timestamp = formatDate(row[0]);
            const name = row[1];
            const phone = row[2];
            const amount = parseFloat(row[3]) || 0;

            let dueDateFormatted = '-';
            if (row[4]) {
                const formatted = formatDate(row[4], true);
                dueDateFormatted = formatted;
            }

            const status = row[5] || 'Paid';
            const badgeClass = status === 'Pending' ? 'badge-pending' : 'badge-paid';
            const actionHtml = status === 'Pending'
                ? `<button class="action-btn" onclick="markAsPaid(${rowNumber}, this, ${amount}, '${name.replace(/'/g, "\\'")}', '${phone}')">Mark as Paid</button>`
                : `<span style="color: #999; font-size: 0.9rem;">✓ Completed</span>`;

            // --- TABLE ROW ---
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${timestamp}</td>
                <td>${name}</td>
                <td>${phone}</td>
                <td style="font-weight: 600;">₹${amount.toLocaleString('en-IN')}</td>
                <td>${dueDateFormatted}</td>
                <td><span class="badge ${badgeClass}">${status}</span></td>
                <td>${actionHtml}</td>
            `;
            tableBody.appendChild(tr);

            // --- MOBILE CARD ---
            const card = document.createElement('div');
            card.className = 'record-card';
            card.innerHTML = `
                <div class="card-row">
                    <span class="card-name">${name}</span>
                    <span class="card-amount">₹${amount.toLocaleString('en-IN')}</span>
                </div>
                <div class="card-row">
                    <div>
                        <div class="card-label">Mobile</div>
                        <div class="card-value">${phone}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="card-label">Added</div>
                        <div class="card-value">${timestamp}</div>
                    </div>
                </div>
                ${dueDateFormatted !== '-' ? `
                <div class="card-row">
                    <div>
                        <div class="card-label">Due Date</div>
                        <div class="card-value">${dueDateFormatted}</div>
                    </div>
                </div>` : ''}
                <div class="card-footer">
                    <span class="badge ${badgeClass}">${status}</span>
                    ${actionHtml}
                </div>
            `;
            cardsContainer.appendChild(card);
        });

    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const statusTerm = statusFilter.value;
        const yearTerm = yearFilter.value;

        const filtered = allRows.filter(item => {
            const row = item.row;
            const name = (row[1] || '').toString().toLowerCase();
            const phone = (row[2] || '').toString().toLowerCase();
            const status = row[5] || 'Paid';

            const matchesSearch = name.includes(searchTerm) || phone.includes(searchTerm);
            const matchesStatus = (statusTerm === 'All') || (statusTerm === status);

            const matchesYear = yearTerm === 'All' || yearFrom(row[0]) === yearTerm;
            return matchesSearch && matchesStatus && matchesYear;
        });

        renderTable(filtered);
    }

    async function fetchRecords() {
        loader.style.display = 'block';
        recordsTable.style.display = 'none';
        summaryCard.style.display = 'none';
        filterSection.style.display = 'none';
        tableBody.innerHTML = '';

        try {
            const [chandaResponse, ladduResponse] = await Promise.all([
                fetch(GOOGLE_SCRIPT_URL),
                fetch(`${GOOGLE_SCRIPT_URL}?action=getLadduAuction`).catch(() => null)
            ]);
            const data = await chandaResponse.json();
            const ladduData = ladduResponse ? await ladduResponse.json().catch(() => ({})) : {};
                loader.style.display = 'none';

                if (data.status === 'success' && data.data) {
                    // Save all rows with their original indices
                    allRows = data.data.slice(1).map((row, index) => ({ row, index }));
                    ladduRows = toLadduRecords(ladduData.data);
                    refreshYearOptions();
                    
                    applyFilters(); // Initial render
                    
                    summaryCard.style.display = 'block';
                    filterSection.style.display = 'flex';
                    recordsTable.style.display = 'table';
                } else {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No records found yet.</td></tr>';
                    recordsTable.style.display = 'table';
                }
        } catch (error) {
                console.error('Error fetching data:', error);
                loader.style.display = 'none';
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load data. Please ensure your Google Script is updated.</td></tr>';
                recordsTable.style.display = 'table';
        }
    }

    // Event listeners for filters
    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);

    window.markAsPaid = function(rowNumber, btn, amount, name, phone) {
        if (!confirm('Are you sure you want to mark this contribution as Paid?')) return;

        // Disable ALL matching buttons (in both table and card)
        document.querySelectorAll('.action-btn').forEach(b => {
            if (b.onclick && b.onclick.toString().includes(`markAsPaid(${rowNumber},`)) {
                b.disabled = true;
                b.innerText = 'Updating...';
            }
        });
        btn.disabled = true;
        btn.innerText = 'Updating...';

        const formData = new FormData();
        formData.append('action', 'updateStatus');
        formData.append('rowNumber', rowNumber);
        formData.append('status', 'Paid');

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors'
        })
        .then(() => {
            // Update the local data cache
            const targetItem = allRows.find(item => item.index + 2 === rowNumber);
            if (targetItem) {
                targetItem.row[5] = 'Paid';
            }

            // Re-render table and cards based on current filters
            applyFilters();

            // Send WhatsApp message
            const message = `Namaskaram ${name} garu,\n\nWe have successfully received your Ganesh Chanda contribution of ₹${amount}. Thank you for fulfilling your pledge!\n\nMay Lord Ganesha bless you with health, wealth, and happiness! 🙏\n\nGanapati Bappa Morya!`;
            const encodedMessage = encodeURIComponent(message);
            window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
        })
        .catch(error => {
            console.error('Error updating status:', error);
            alert('Failed to update status.');
            applyFilters(); // Re-render to restore button state
        });
    };


    fetchRecords();
});
