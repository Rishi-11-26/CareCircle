// ============================================================================
// SUPABASE EDGE FUNCTION: send-email
// Transactional email dispatcher via Resend API
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  type?: 'invitation' | 'appointment' | 'alert' | 'test';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RESEND_API_KEY is not configured in the server environment. Email skipped; in-app notification remains fully functional.",
          mockDelivered: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: EmailPayload = await req.json();
    if (!payload.to || !payload.subject || !payload.html) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, subject, or html." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CareCircle <notifications@resend.dev>",
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Resend API error", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id, message: "Email sent successfully." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
