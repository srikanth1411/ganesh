document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('chandaForm');
    const submitBtn = document.querySelector('.submit-btn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Add a small click animation to button
        submitBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            submitBtn.style.transform = '';
        }, 150);

        // Get form values
        const name = document.getElementById('name').value.trim();
        let phone = document.getElementById('phone').value.trim();
        const amount = document.getElementById('amount').value.trim();
        const dueDate = document.getElementById('dueDate').value;

        if (!name || !phone || !amount) {
            alert('Please fill in all fields');
            return;
        }

        // Clean phone number
        phone = phone.replace(/[^0-9]/g, '');
        
        // Add country code if it's 10 digits
        if (phone.length === 10) {
            phone = '91' + phone;
        } else if (phone.length !== 12) {
            // Very basic validation, assuming India format or full international
            alert('Please enter a valid 10-digit mobile number.');
            return;
        }

        // Construct the message
        let message = '';
        if (dueDate) {
            const dateObj = new Date(dueDate);
            const formattedDate = isNaN(dateObj.getTime()) ? dueDate : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            message = `Namaskaram ${name} garu,\n\nThank you for your generous pledge of ₹${amount} towards the Ganesh Chanda. This is a gentle reminder that the scheduled due date for your contribution is ${formattedDate}.\n\nPlease complete the payment at your earliest convenience.\n\nMay Lord Ganesha bless you! 🙏\n\nGanapati Bappa Morya!`;
        } else {
            message = `Namaskaram ${name} garu,\n\nThank you for your generous contribution of ₹${amount} towards the Ganesh Chanda.\n\nMay Lord Ganesha bless you with health, wealth, and happiness! 🙏\n\nGanapati Bappa Morya!`;
        }

        // Encode message for URL
        const encodedMessage = encodeURIComponent(message);

        // --- Google Sheets Integration ---
        // REPLACE THIS URL with your actual Google Apps Script Web App URL
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8QbbQ1XE3nDjED5ZFtZacFu5vNXs6wGh-GN0YULF0ApbqDlpreeFxA7Ri7STr3QDSxQ/exec';
        
        if (GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL_HERE') {
            const formData = new FormData();
            formData.append('action', 'add'); // Specify action type for Apps Script
            formData.append('Name', name);
            formData.append('WhatsApp Number', phone);
            formData.append('Amount', amount);
            formData.append('Due Date', dueDate);
            formData.append('Timestamp', new Date().toLocaleString());
            formData.append('Payment Status', dueDate ? 'Pending' : 'Paid');

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: formData,
                mode: 'no-cors' // This avoids CORS errors but hides the response
            }).then(() => {
                console.log('Data successfully sent to Google Sheets');
                window.GaneshSuccessScreen?.show({
                    title: 'Chanda Recorded',
                    message: 'Your contribution request has been sent successfully. The WhatsApp message has also been opened.',
                    buttonText: 'Done'
                });
            }).catch(error => {
                console.error('Error sending data to Google Sheets:', error);
                window.GaneshSuccessScreen?.show({
                    title: 'Save Failed',
                    message: 'The form could not be saved right now. Please try again.',
                    buttonText: 'Retry'
                });
            });
        }
        // ---------------------------------

        // Open WhatsApp Web/App
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');

        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL_HERE') {
            window.GaneshSuccessScreen?.show({
                title: 'WhatsApp Ready',
                message: 'The fundraiser form is ready. Please update the Google Apps Script URL to enable sheet saving.',
                buttonText: 'Close'
            });
        }

        // Optional: Reset form or show success message
        // form.reset();
    });
});
