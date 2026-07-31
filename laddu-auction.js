document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';
    const form = document.getElementById('ladduAuctionForm');
    const canvas = document.getElementById('auctionSignature');
    const ctx = canvas.getContext('2d');
    const message = document.getElementById('auctionMessage');
    const saveBtn = document.getElementById('saveAuctionBtn');
    const camera = document.getElementById('auctionCamera');
    const photoCanvas = document.getElementById('auctionPhotoCanvas');
    const photoPreview = document.getElementById('auctionPhotoPreview');
    const startCameraBtn = document.getElementById('startCamera');
    const capturePhotoBtn = document.getElementById('capturePhoto');
    const retakePhotoBtn = document.getElementById('retakePhoto');
    let drawing = false;
    let signed = false;
    let photoDataUrl = '';
    let cameraStream = null;

    function setMessage(text, type = '') {
        message.textContent = text;
        message.className = `form-message ${type}`;
    }

    function resizeCanvas() {
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
    }

    function point(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', event => {
        drawing = true;
        signed = true;
        canvas.setPointerCapture(event.pointerId);
        const start = point(event);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
    });
    canvas.addEventListener('pointermove', event => {
        if (!drawing) return;
        const next = point(event);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
    });
    ['pointerup', 'pointercancel'].forEach(type => canvas.addEventListener(type, () => { drawing = false; }));
    document.getElementById('clearAuctionSignature').addEventListener('click', () => { signed = false; resizeCanvas(); });
    window.addEventListener('resize', () => { if (!signed) resizeCanvas(); });
    resizeCanvas();

    function stopCamera() {
        cameraStream?.getTracks().forEach(track => track.stop());
        cameraStream = null;
        camera.srcObject = null;
    }

    async function startCamera() {
        stopCamera();
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
                audio: false
            });
            camera.srcObject = cameraStream;
            camera.hidden = false;
            photoPreview.hidden = true;
            capturePhotoBtn.disabled = false;
            startCameraBtn.textContent = 'Restart Camera';
            setMessage('');
        } catch (error) {
            setMessage('Camera access is needed to take the winner photo. Please allow camera permission and try again.', 'error');
        }
    }

    function capturePhoto() {
        if (!camera.videoWidth || !camera.videoHeight) return;
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(camera.videoWidth, camera.videoHeight));
        photoCanvas.width = Math.round(camera.videoWidth * scale);
        photoCanvas.height = Math.round(camera.videoHeight * scale);
        photoCanvas.getContext('2d').drawImage(camera, 0, 0, photoCanvas.width, photoCanvas.height);
        photoDataUrl = photoCanvas.toDataURL('image/jpeg', 0.85);
        photoPreview.src = photoDataUrl;
        photoPreview.hidden = false;
        camera.hidden = true;
        capturePhotoBtn.disabled = true;
        retakePhotoBtn.hidden = false;
        stopCamera();
    }

    startCameraBtn.addEventListener('click', startCamera);
    capturePhotoBtn.addEventListener('click', capturePhoto);
    retakePhotoBtn.addEventListener('click', () => {
        photoDataUrl = '';
        retakePhotoBtn.hidden = true;
        startCamera();
    });
    window.addEventListener('pagehide', stopCamera);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const name = document.getElementById('winnerName').value.trim();
        const phoneDigits = document.getElementById('winnerPhone').value.replace(/\D/g, '');
        const amount = Number(document.getElementById('auctionAmount').value);
        if (!name || phoneDigits.length !== 10 || !amount || amount <= 0) {
            setMessage('Enter the winner name, a valid mobile number, and the final bid amount.', 'error');
            return;
        }
        if (!photoDataUrl) {
            setMessage('Please take or select the auction winner photo.', 'error');
            return;
        }
        if (!signed) {
            setMessage('Please collect the auction winner signature.', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        const data = new FormData();
        data.append('action', 'recordLadduAuction');
        data.append('Name', name);
        data.append('WhatsApp Number', `91${phoneDigits}`);
        data.append('Laddu Amount', amount);
        data.append('Amount Collected', '0');
        data.append('Auction Photo', photoDataUrl);
        data.append('Signature', canvas.toDataURL('image/png'));
        data.append('Timestamp', new Date().toLocaleString('en-IN'));

        try {
            await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: data, mode: 'no-cors' });
            setMessage('Auction details and signature have been sent. Please verify them in the Sheet.', 'success');
            form.reset();
            signed = false;
            photoDataUrl = '';
            photoPreview.removeAttribute('src');
            photoPreview.hidden = true;
            retakePhotoBtn.hidden = true;
            capturePhotoBtn.disabled = true;
            resizeCanvas();
        } catch (error) {
            setMessage('Could not save the auction details. Please try again.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Auction Details';
        }
    });
});
