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
    const form = document.getElementById('spendForm');
    const dateInput = document.getElementById('spendDate');
    const message = document.getElementById('spendMessage');
    const button = document.getElementById('saveSpend');
    const billFile = document.getElementById('billFile');
    const billPhotoPreview = document.getElementById('billPhotoPreview');
    const openCameraButton = document.getElementById('openBillCamera');
    const cameraPanel = document.getElementById('billCameraPanel');
    const cameraPreview = document.getElementById('billCameraPreview');
    const cameraCanvas = document.getElementById('billCameraCanvas');
    const captureCameraButton = document.getElementById('captureBillPhoto');
    const closeCameraButton = document.getElementById('closeBillCamera');
    let billPhotoData = '';
    let billCameraStream = null;
    dateInput.value = new Date().toISOString().slice(0, 10);

    function handleBillPhoto(event) {
        const file = event.target.files[0];
        billPhotoData = '';
        billPhotoPreview.hidden = true;
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            message.textContent = 'Please select a valid bill image.';
            message.className = 'form-message error';
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            billPhotoData = reader.result;
            billPhotoPreview.src = billPhotoData;
            billPhotoPreview.hidden = false;
        };
        reader.readAsDataURL(file);
    }
    billFile.addEventListener('change', handleBillPhoto);

    function stopBillCamera() {
        billCameraStream?.getTracks().forEach(track => track.stop());
        billCameraStream = null;
        cameraPreview.srcObject = null;
        cameraPanel.hidden = true;
    }

    openCameraButton.addEventListener('click', async () => {
        try {
            billCameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
                audio: false
            });
            cameraPreview.srcObject = billCameraStream;
            cameraPanel.hidden = false;
            message.textContent = '';
        } catch (error) {
            message.textContent = 'Unable to open the camera. Please allow camera access, or use Choose File.';
            message.className = 'form-message error';
        }
    });

    captureCameraButton.addEventListener('click', () => {
        if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) return;
        const scale = Math.min(1, 1280 / Math.max(cameraPreview.videoWidth, cameraPreview.videoHeight));
        cameraCanvas.width = Math.round(cameraPreview.videoWidth * scale);
        cameraCanvas.height = Math.round(cameraPreview.videoHeight * scale);
        cameraCanvas.getContext('2d').drawImage(cameraPreview, 0, 0, cameraCanvas.width, cameraCanvas.height);
        billPhotoData = cameraCanvas.toDataURL('image/jpeg', 0.85);
        billPhotoPreview.src = billPhotoData;
        billPhotoPreview.hidden = false;
        stopBillCamera();
    });
    closeCameraButton.addEventListener('click', stopBillCamera);
    window.addEventListener('pagehide', stopBillCamera);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const amount = Number(document.getElementById('spendAmount').value);
        if (!amount || amount <= 0) { message.textContent = 'Enter a valid spend amount.'; message.className = 'form-message error'; return; }
        button.disabled = true; button.textContent = 'Saving…';
        const data = new FormData();
        data.append('action', 'recordSpend');
        window.GaneshAuth?.addUser(data);
        data.append('Date', dateInput.value);
        data.append('Spend Type', document.getElementById('spendType').value);
        data.append('Item / Purpose', document.getElementById('spendItem').value.trim());
        data.append('Amount', amount);
        data.append('Notes', document.getElementById('spendNotes').value.trim());
        data.append('Bill Photo', billPhotoData);
        data.append('Timestamp', new Date().toLocaleString('en-IN'));
        try {
            await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: data, mode: 'no-cors' });
            message.textContent = 'Spend record sent successfully.'; message.className = 'form-message success';
            form.reset(); dateInput.value = new Date().toISOString().slice(0, 10);
            billPhotoData = '';
            billPhotoPreview.removeAttribute('src');
            billPhotoPreview.hidden = true;
            stopBillCamera();
        } catch (error) {
            message.textContent = 'Could not save the spend. Please try again.'; message.className = 'form-message error';
        } finally { button.disabled = false; button.textContent = 'Record Spend'; }
    });
});
