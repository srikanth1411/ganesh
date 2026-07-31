document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';
    const form = document.getElementById('ladduCollectionForm');
    const phoneInput = document.getElementById('ladduPhone');
    const lookupBtn = document.getElementById('lookupBtn');
    const paymentInput = document.getElementById('paymentAmount');
    const collectBtn = document.getElementById('collectBtn');
    const auctionDetails = document.getElementById('auctionDetails');
    const message = document.getElementById('collectionMessage');
    const canvas = document.getElementById('signatureCanvas');
    const clearBtn = document.getElementById('clearSignature');
    const ctx = canvas.getContext('2d');

    let auction = null;
    let drawing = false;
    let signatureStarted = false;

    function cleanPhone(value) {
        const digits = value.replace(/\D/g, '');
        return digits.length === 10 ? `91${digits}` : digits;
    }

    function numberValue(value) {
        return Number(String(value ?? '').replace(/[^0-9.]/g, '')) || 0;
    }

    function setMessage(text, type = '') {
        message.textContent = text;
        message.className = `form-message ${type}`;
    }

    // Accepts common column names so the auction sheet can use either Laddu Amount,
    // Auction Amount, or Total Amount. Row 1 must contain column headings.
    function toRecords(data) {
        if (!Array.isArray(data) || data.length < 2) return [];
        const headers = data[0].map(header => String(header || '').trim().toLowerCase());
        return data.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
    }

    function valueFrom(record, keys) {
        const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(record, candidate));
        return key ? record[key] : '';
    }

    function drawAuctionDetails() {
        document.getElementById('auctionName').textContent = auction.name;
        document.getElementById('totalLadduAmount').textContent = `₹${auction.total.toLocaleString('en-IN')}`;
        document.getElementById('alreadyCollected').textContent = `₹${auction.collected.toLocaleString('en-IN')}`;
        document.getElementById('balanceDue').textContent = `₹${auction.balance.toLocaleString('en-IN')}`;
        auctionDetails.hidden = false;
        paymentInput.disabled = auction.balance <= 0;
        collectBtn.disabled = auction.balance <= 0;
        paymentInput.max = auction.balance;
    }

    async function lookupAuction() {
        const phone = cleanPhone(phoneInput.value);
        if (phone.length !== 12 || !phone.startsWith('91')) {
            setMessage('Enter a valid 10-digit Indian mobile number.', 'error');
            return;
        }

        lookupBtn.disabled = true;
        lookupBtn.textContent = 'Finding…';
        setMessage('');
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getLadduAuction`);
            const payload = await response.json();
            const records = toRecords(payload.data);
            const record = records.find(item => cleanPhone(String(valueFrom(item, ['whatsapp number', 'mobile number', 'phone', 'mobile']))) === phone);
            if (!record) throw new Error('not-found');

            const name = valueFrom(record, ['name', 'devotee name', 'auction winner', 'winner name']);
            const total = numberValue(valueFrom(record, ['laddu amount', 'auction amount', 'total laddu amount', 'total amount']));
            const collected = numberValue(valueFrom(record, ['amount collected', 'collected amount', 'paid amount', 'amount paid']));
            if (!name || total <= 0) throw new Error('incomplete');

            auction = { name, phone, total, collected, balance: Math.max(total - collected, 0) };
            drawAuctionDetails();
            setMessage(auction.balance > 0 ? 'Auction details loaded. Record the payment and signature below.' : 'This Laddu amount has already been fully collected.', 'success');
        } catch (error) {
            auction = null;
            auctionDetails.hidden = true;
            paymentInput.disabled = true;
            collectBtn.disabled = true;
            setMessage(error.message === 'not-found' ? 'No Laddu auction record was found for this number.' : 'Could not load the auction details. Please check the Sheet setup and try again.', 'error');
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.textContent = 'Find Auction Details';
        }
    }

    function sizeCanvas() {
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const image = signatureStarted ? canvas.toDataURL() : null;
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        if (image) {
            const saved = new Image();
            saved.onload = () => ctx.drawImage(saved, 0, 0, rect.width, rect.height);
            saved.src = image;
        }
    }

    function position(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', event => {
        drawing = true;
        signatureStarted = true;
        canvas.setPointerCapture(event.pointerId);
        const point = position(event);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
    });
    canvas.addEventListener('pointermove', event => {
        if (!drawing) return;
        const point = position(event);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => canvas.addEventListener(type, () => { drawing = false; }));
    clearBtn.addEventListener('click', () => { signatureStarted = false; sizeCanvas(); });
    window.addEventListener('resize', sizeCanvas);
    sizeCanvas();

    lookupBtn.addEventListener('click', lookupAuction);
    phoneInput.addEventListener('change', () => { auction = null; auctionDetails.hidden = true; paymentInput.disabled = true; collectBtn.disabled = true; });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const amount = numberValue(paymentInput.value);
        if (!auction || amount <= 0 || amount > auction.balance) {
            setMessage(`Enter an amount between ₹1 and ₹${auction?.balance?.toLocaleString('en-IN') || 0}.`, 'error');
            return;
        }
        if (!signatureStarted) {
            setMessage('Please collect the payer signature before recording payment.', 'error');
            return;
        }

        collectBtn.disabled = true;
        collectBtn.textContent = 'Recording…';
        const formData = new FormData();
        formData.append('action', 'recordLadduPayment');
        formData.append('Name', auction.name);
        formData.append('WhatsApp Number', auction.phone);
        formData.append('Total Laddu Amount', auction.total);
        formData.append('Amount Received', amount);
        formData.append('Balance After Payment', auction.balance - amount);
        formData.append('Signature', canvas.toDataURL('image/png'));
        formData.append('Timestamp', new Date().toLocaleString('en-IN'));

        try {
            await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData, mode: 'no-cors' });
            setMessage('Payment record sent successfully. Please verify it in the Sheet.', 'success');
            auction.collected += amount;
            auction.balance -= amount;
            paymentInput.value = '';
            signatureStarted = false;
            sizeCanvas();
            drawAuctionDetails();
        } catch (error) {
            setMessage('The payment could not be sent. Please try again.', 'error');
        } finally {
            collectBtn.textContent = 'Record Payment';
            collectBtn.disabled = !auction || auction.balance <= 0;
        }
    });
});
