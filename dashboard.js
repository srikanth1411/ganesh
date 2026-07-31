document.addEventListener('DOMContentLoaded', () => {
    // URL to your Google Apps Script Web App
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';

    const loader = document.getElementById('loader');
    const recordsTable = document.getElementById('recordsTable');
    const tableBody = document.getElementById('tableBody');
    const summaryCard = document.getElementById('summaryCard');
    const totalAmountEl = document.getElementById('totalAmount');
    
    // Filter elements
    const filterSection = document.getElementById('filterSection');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');

    let allRows = [];

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

        let totalCollected = 0;

        if (rowsToRender.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No records match your search.</td></tr>';
            cardsContainer.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">No records match your search.</p>';
            totalAmountEl.textContent = '₹0';
            return;
        }

        rowsToRender.forEach((item) => {
            const { row, index } = item;
            const rowNumber = index + 2;

            const timestamp = new Date(row[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const name = row[1];
            const phone = row[2];
            const amount = parseFloat(row[3]) || 0;

            let dueDateFormatted = '-';
            if (row[4]) {
                const d = new Date(row[4]);
                if (!isNaN(d.getTime())) {
                    dueDateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                } else {
                    dueDateFormatted = row[4];
                }
            }

            const status = row[5] || 'Paid';
            if (status === 'Paid') totalCollected += amount;

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

        totalAmountEl.textContent = `₹${totalCollected.toLocaleString('en-IN')}`;
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const statusTerm = statusFilter.value;

        const filtered = allRows.filter(item => {
            const row = item.row;
            const name = (row[1] || '').toString().toLowerCase();
            const phone = (row[2] || '').toString().toLowerCase();
            const status = row[5] || 'Paid';

            const matchesSearch = name.includes(searchTerm) || phone.includes(searchTerm);
            const matchesStatus = (statusTerm === 'All') || (statusTerm === status);

            return matchesSearch && matchesStatus;
        });

        renderTable(filtered);
    }

    function fetchRecords() {
        loader.style.display = 'block';
        recordsTable.style.display = 'none';
        summaryCard.style.display = 'none';
        filterSection.style.display = 'none';
        tableBody.innerHTML = '';

        fetch(GOOGLE_SCRIPT_URL)
            .then(response => response.json())
            .then(data => {
                loader.style.display = 'none';

                if (data.status === 'success' && data.data && data.data.length > 1) {
                    // Save all rows with their original indices
                    allRows = data.data.slice(1).map((row, index) => ({ row, index }));
                    
                    applyFilters(); // Initial render
                    
                    summaryCard.style.display = 'block';
                    filterSection.style.display = 'flex';
                    recordsTable.style.display = 'table';
                } else {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No records found yet.</td></tr>';
                    recordsTable.style.display = 'table';
                }
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                loader.style.display = 'none';
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load data. Please ensure your Google Script is updated.</td></tr>';
                recordsTable.style.display = 'table';
            });
    }

    // Event listeners for filters
    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);

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
