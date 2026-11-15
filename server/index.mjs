// ============================================================================
// CARECIRCLE UNIFIED PRODUCTION SERVER
// Single integrated Node.js service for Render Deployment
// Serves Vite SPA assets, health checks, background scheduler, and Resend API
// ============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = parseInt(process.env.PORT || '10000', 10);
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// ----------------------------------------------------------------------------
// Background Scheduler: Escalation & Reminder Engine
// Runs every 2 minutes while the web service is alive
// ----------------------------------------------------------------------------
async function runEscalationCycle() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { skipped: true, reason: 'Database environment variables not configured' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/medication_schedules?select=*,medications(*),care_profiles(*)&is_active=eq.true`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });

    if (!response.ok) {
      return { success: false, status: response.status, error: await response.text() };
    }

    const schedules = await response.json();
    return { success: true, processedSchedules: Array.isArray(schedules) ? schedules.length : 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// Email Dispatcher via Resend API (Server-side key only)
// ----------------------------------------------------------------------------
async function sendResendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured in server environment.' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'CareCircle <notifications@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, status: res.status, error: data.message || 'Resend API error', details: data };
  }
  return { success: true, id: data.id };
}

// ----------------------------------------------------------------------------
// HTTP Request Router
// ----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS Headers for API
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // 1. Health Endpoint: /api/health
  if (pathname === '/api/health') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'CareCircle Unified Web Service',
      version: '2.2.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        target: process.env.VITE_SUPABASE_URL || 'https://irkbphurzdhghptwfemz.supabase.co',
        configured: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      },
      emailService: {
        configured: Boolean(process.env.RESEND_API_KEY),
      },
      scheduler: {
        active: true,
        intervalMinutes: 2,
      },
    }));
    return;
  }

  // 2. Scheduler Trigger Endpoint: /api/scheduler/run-escalations
  if (pathname === '/api/scheduler/run-escalations' && req.method === 'POST') {
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers['x-cron-secret'] || (req.headers.authorization || '').replace('Bearer ', '');

    if (cronSecret && providedSecret !== cronSecret) {
      res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid CRON_SECRET.' }));
      return;
    }

    const runResult = await runEscalationCycle();
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString(), result: runResult }));
    return;
  }

  // 3. Email Dispatch Endpoint: /api/send-email
  if (pathname === '/api/send-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.to || !payload.subject || !payload.html) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing required fields: to, subject, or html.' }));
          return;
        }

        const emailResult = await sendResendEmail(payload);
        res.writeHead(emailResult.success ? 200 : 500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(emailResult));
      } catch (err) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload: ' + err.message }));
      }
    });
    return;
  }

  // 4. Static Asset & SPA Fallback Serving
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    // If file exists and is a file, serve it
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isHashedAsset = pathname.startsWith('/assets/');
      const cacheControl = isHashedAsset
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': cacheControl,
      });

      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // SPA Fallback: Return index.html for application routes
    const indexPath = path.join(DIST_DIR, 'index.html');
    fs.stat(indexPath, (indexErr, indexStats) => {
      if (indexErr || !indexStats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Application bundle not found. Please run "npm run build" first.');
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': indexStats.size,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });

      fs.createReadStream(indexPath).pipe(res);
    });
  });
});

// Start Server
server.listen(PORT, HOST, () => {
  console.log(`[CareCircle] Integrated production server listening on http://${HOST}:${PORT}`);
  console.log(`[CareCircle] Serving SPA assets from ${DIST_DIR}`);
  console.log(`[CareCircle] Health check available at http://${HOST}:${PORT}/api/health`);

  // Start in-process background scheduler (every 2 minutes)
  setInterval(() => {
    runEscalationCycle().catch(err => console.error('[CareCircle Scheduler Error]', err));
  }, 2 * 60 * 1000);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[CareCircle] SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[CareCircle] SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
