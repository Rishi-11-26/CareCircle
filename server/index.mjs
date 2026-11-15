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
// Runs every 2 minutes while the web service is alive.
// Handles upcoming dose reminders, overdue escalations, idempotent deduplication,
// IANA timezone alignment, and Resend transactional email alerts.
// ----------------------------------------------------------------------------
async function runEscalationCycle() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { skipped: true, reason: 'Database environment variables not configured in server environment.' };
  }

  const result = {
    processedSchedules: 0,
    upcomingRemindersSent: 0,
    escalationsTriggered: 0,
    emailsDispatched: 0,
    errors: [],
  };

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/medication_schedules?select=*,medications(*),care_profiles(*)&is_active=eq.true`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    if (!res.ok) {
      return { success: false, status: res.status, error: await res.text() };
    }

    const schedules = await res.json();
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return { success: true, ...result, message: 'No active schedules found.' };
    }

    const nowUtc = new Date();

    for (const schedule of schedules) {
      result.processedSchedules++;
      const careProfile = schedule.care_profiles;
      const medication = schedule.medications;
      if (!careProfile || !medication) continue;

      const profileTz = careProfile.timezone || 'UTC';

      // Determine local date, time, and day-of-week in the patient's configured IANA timezone
      let localParts;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: profileTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        });
        const parts = formatter.formatToParts(nowUtc);
        const map = {};
        for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
        localParts = {
          dateStr: `${map.year}-${map.month}-${map.day}`,
          timeStr: `${map.hour}:${map.minute}`,
          dayOfWeek: new Date(`${map.year}-${map.month}-${map.day}T12:00:00Z`).getUTCDay(),
          hour: parseInt(map.hour, 10),
          minute: parseInt(map.minute, 10),
        };
      } catch (tzErr) {
        result.errors.push(`Invalid timezone '${profileTz}' for profile ${careProfile.id}: ${tzErr.message}`);
        continue;
      }

      // Check if scheduled for today
      const daysOfWeek = schedule.days_of_week || [0, 1, 2, 3, 4, 5, 6];
      if (!daysOfWeek.includes(localParts.dayOfWeek)) continue;

      const [schedH, schedM] = schedule.time_of_day.split(':').map(Number);
      const scheduledMinutesOfDay = schedH * 60 + schedM;
      const currentMinutesOfDay = localParts.hour * 60 + localParts.minute;
      const diffMinutes = currentMinutesOfDay - scheduledMinutesOfDay; // Positive = overdue, Negative = upcoming

      const doseIdentity = `dose_${medication.id}_${localParts.dateStr}_${schedule.time_of_day.slice(0, 5)}`;
      const gracePeriod = schedule.grace_period_minutes || 45;

      // 1. Upcoming Dose Reminder (15 to 30 minutes before scheduled time)
      if (diffMinutes >= -30 && diffMinutes <= -15) {
        // Idempotency: check if upcoming notification was already generated
        const checkNotif = await fetch(
          `${supabaseUrl}/rest/v1/notifications?care_profile_id=eq.${careProfile.id}&category=eq.upcoming_dose&metadata->>dose_identity=eq.${doseIdentity}&select=id`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        );
        const existing = await checkNotif.json();
        if (!Array.isArray(existing) || existing.length === 0) {
          await fetch(`${supabaseUrl}/rest/v1/notifications`, {
            method: 'POST',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              care_profile_id: careProfile.id,
              category: 'upcoming_dose',
              title: `Upcoming Medication: ${medication.name}`,
              message: `${careProfile.preferred_name || careProfile.full_name}'s ${medication.name} (${medication.dosage}) is scheduled for ${schedule.time_of_day.slice(0, 5)}.`,
              priority: 'normal',
              status: 'pending',
              metadata: { dose_identity: doseIdentity, scheduled_time: schedule.time_of_day },
            }),
          });
          result.upcomingRemindersSent++;
        }
      }

      // 2. Missed Dose Escalation (After grace period has elapsed)
      if (diffMinutes > gracePeriod) {
        // Check if dose has already been confirmed (taken or skipped) in dose_logs
        const checkDose = await fetch(
          `${supabaseUrl}/rest/v1/dose_logs?care_profile_id=eq.${careProfile.id}&dose_identity=eq.${doseIdentity}&status=in.(taken,skipped)&select=id,status`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        );
        const doseRows = await checkDose.json();
        if (Array.isArray(doseRows) && doseRows.length > 0) {
          // Already taken or skipped; no escalation required
          continue;
        }

        // Idempotency: check if escalation notification was already created for this dose
        const checkEsc = await fetch(
          `${supabaseUrl}/rest/v1/notifications?care_profile_id=eq.${careProfile.id}&category=eq.unconfirmed_escalation&metadata->>dose_identity=eq.${doseIdentity}&select=id`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        );
        const existingEsc = await checkEsc.json();
        if (Array.isArray(existingEsc) && existingEsc.length > 0) {
          // Already escalated and tracked; prevent duplicate notifications across scheduler runs
          continue;
        }

        const personName = careProfile.preferred_name || careProfile.full_name;
        const alertTitle = `Unconfirmed Dose: ${medication.name} (${medication.dosage})`;
        const alertMsg = `${personName}'s scheduled ${medication.name} (${medication.dosage}) at ${schedule.time_of_day.slice(0, 5)} has not been confirmed after ${diffMinutes} minutes.`;

        // Create persistent escalation notification
        const notifRes = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            care_profile_id: careProfile.id,
            category: 'unconfirmed_escalation',
            title: alertTitle,
            message: alertMsg,
            priority: 'urgent',
            status: 'pending',
            email_status: process.env.RESEND_API_KEY ? 'pending' : 'none',
            metadata: {
              dose_identity: doseIdentity,
              medication_id: medication.id,
              medication_name: medication.name,
              dosage: medication.dosage,
              scheduled_time: schedule.time_of_day,
              scheduled_date: localParts.dateStr,
              elapsed_minutes: diffMinutes,
            },
          }),
        });

        const createdNotifs = await notifRes.json();
        const notifId = Array.isArray(createdNotifs) && createdNotifs[0]?.id;
        result.escalationsTriggered++;

        // Log to immutable activity timeline
        await fetch(`${supabaseUrl}/rest/v1/activity_logs`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            care_profile_id: careProfile.id,
            actor_name: 'Care Intelligence System',
            actor_role: 'system',
            activity_type: 'dose_unconfirmed_escalated',
            description: `Automated escalation triggered for ${personName}'s ${medication.name} (${schedule.time_of_day.slice(0, 5)}).`,
            metadata: { dose_identity: doseIdentity, notification_id: notifId },
          }),
        });

        // Dispatch Resend Email Alerts to subscribed Care Circle members
        if (process.env.RESEND_API_KEY) {
          const membersRes = await fetch(
            `${supabaseUrl}/rest/v1/care_members?care_profile_id=eq.${careProfile.id}&status=eq.active&receive_email_alerts=eq.true&select=user_id,role,profiles(email,full_name)`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
          );
          const members = await membersRes.json();
          if (Array.isArray(members)) {
            for (const member of members) {
              const recipientEmail = member.profiles?.email;
              if (!recipientEmail) continue;

              const emailHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #F7F5EF; color: #292D29; border-radius: 12px; border: 1px solid #E7E4DA;">
                  <div style="border-bottom: 2px solid #25483D; padding-bottom: 12px; margin-bottom: 20px;">
                    <span style="font-size: 20px; font-weight: 700; color: #25483D; letter-spacing: -0.5px;">CareCircle</span>
                    <span style="display: block; font-size: 13px; color: #717770;">Connected care. Independent living.</span>
                  </div>
                  <div style="background: #FFFFFF; padding: 20px; border-radius: 8px; border: 1px solid #E7E4DA; margin-bottom: 20px;">
                    <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #FDF4F0; color: #A65A3E; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">
                      Care Follow-up Notice
                    </div>
                    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #292D29;">${alertTitle}</h2>
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #4E534E;">
                      ${alertMsg}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #717770; font-style: italic;">
                      Note: An unconfirmed dose does not necessarily mean the medication was missed. We recommend kindly checking in with ${personName}.
                    </p>
                  </div>
                </div>`;

              const emailRes = await sendResendEmail({
                to: recipientEmail,
                subject: `CareCircle Alert: ${alertTitle}`,
                html: emailHtml,
              });

              if (emailRes.success) {
                result.emailsDispatched++;
                if (notifId) {
                  await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${notifId}`, {
                    method: 'PATCH',
                    headers: {
                      apikey: serviceKey,
                      Authorization: `Bearer ${serviceKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      email_status: 'sent',
                      email_sent_at: new Date().toISOString(),
                      email_recipient: recipientEmail,
                    }),
                  });
                }
              } else if (notifId) {
                await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${notifId}`, {
                  method: 'PATCH',
                  headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email_status: 'failed',
                    email_error: emailRes.error,
                  }),
                });
              }
            }
          }
        }
      }
    }

    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message, stack: err.stack };
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
