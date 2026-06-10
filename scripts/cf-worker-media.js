// GNECT Media Proxy — Cloudflare Worker
// Proxies Telegram Bot API requests to bypass blocks in Tanzania & Kenya
// Routes:
//   POST /upload → forwards to telegram bot sendPhoto endpoint
//   GET /file/:path → proxies file downloads from telegram

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const botToken = env.BOT_TOKEN;

    if (!botToken) {
      return new Response(JSON.stringify({ error: 'BOT_TOKEN not configured' }), { status: 500 });
    }

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // File download: GET /file/:path
    if (url.pathname.startsWith('/file/')) {
      const filePath = url.pathname.replace('/file/', '');
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
      
      try {
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) {
          return new Response(JSON.stringify({ error: 'File not found' }), { 
            status: fileRes.status, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }
        
        const blob = await fileRes.blob();
        return new Response(blob, {
          headers: {
            'Content-Type': fileRes.headers.get('Content-Type') || 'application/octet-stream',
            'Cache-Control': 'public, max-age=86400',
            ...corsHeaders,
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'File download failed' }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    }

    // API proxy: POST /bot/:method
    if (url.pathname.startsWith('/bot/')) {
      const method = url.pathname.replace('/bot/', '');
      const telegramUrl = `https://api.telegram.org/bot${botToken}/${method}`;
      
      try {
        const headers = new Headers(request.headers);
        headers.delete('host');
        
        // Forward form data or JSON
        let body;
        if (request.headers.get('Content-Type')?.includes('multipart/form-data')) {
          body = await request.arrayBuffer();
        } else {
          body = await request.text();
        }

        const tgRes = await fetch(telegramUrl, {
          method: 'POST',
          headers,
          body,
        });

        const data = await tgRes.text();
        return new Response(data, {
          status: tgRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Telegram API request failed' }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    }

    // Root info page
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(JSON.stringify({
        service: 'GNECT Media Proxy',
        version: '1.0.0',
        status: 'operational',
        endpoints: {
          health: '/health',
          upload: '/bot/sendPhoto (POST)',
          file: '/file/:path (GET)',
          api: '/bot/:method (POST)',
        },
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found', hint: 'See / for available endpoints' }), { 
      status: 404, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  },
};
