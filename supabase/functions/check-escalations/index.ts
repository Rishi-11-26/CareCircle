// ============================================================================
// SUPABASE EDGE FUNCTION: check-escalations
// Identifies overdue doses, escalates to care circle members & sends Resend alerts
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EscalationResult {
  processed: number;
  escalatedDoses: string[];
  notificationsCreated: number;
  emailsSent: number;
  emailsFailed: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const result: EscalationResult = {
    processed: 0,
    escalatedDoses: [],
    notificationsCreated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: [],
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration in server environment.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Current date and time in UTC / Local context
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const currentTimeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS
    const currentDayOfWeek = now.getDay(); // 0 = Sun

    // Fetch all active medications and their schedules
    const { data: schedules, error: scheduleError } = await supabase
      .from("medication_schedules")
      .select(`
        id,
        medication_id,
        care_profile_id,
        time_of_day,
        days_of_week,
        grace_period_minutes,
        escalation_delay_minutes,
        medications (
          id,
          name,
          dosage,
          form,
          instructions
        ),
        care_profiles (
          id,
          full_name,
          preferred_name
        )
      `)
      .eq("is_active", true);

    if (scheduleError) {
      throw scheduleError;
    }

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active schedules found.", result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each schedule
    for (const schedule of schedules) {
      result.processed++;

      // Check if scheduled for today
      if (!schedule.days_of_week.includes(currentDayOfWeek)) {
        continue;
      }

      // Calculate scheduled datetime
      const [schedH, schedM] = schedule.time_of_day.split(":").map(Number);
      const scheduledDateTime = new Date(now);
      scheduledDateTime.setHours(schedH, schedM, 0, 0);

      const elapsedMinutes = (now.getTime() - scheduledDateTime.getTime()) / (1000 * 60);
      const gracePeriod = schedule.grace_period_minutes || 30;

      // Only escalate if overdue beyond grace period
      if (elapsedMinutes <= gracePeriod) {
        continue;
      }

      const med = schedule.medications as any;
      const careProfile = schedule.care_profiles as any;
      if (!med || !careProfile) continue;

      const doseIdentity = `dose_${med.id}_${todayStr}_${schedule.time_of_day.slice(0, 5)}`;

      // Check existing dose log
      const { data: existingDose } = await supabase
        .from("dose_logs")
        .select("id, status")
        .eq("care_profile_id", schedule.care_profile_id)
        .eq("dose_identity", doseIdentity)
        .maybeSingle();

      // If already taken or skipped, no escalation needed
      if (existingDose && (existingDose.status === "taken" || existingDose.status === "skipped")) {
        continue;
      }

      // If dose log does not exist or is scheduled/due, mark it as 'unconfirmed'
      if (!existingDose) {
        await supabase.from("dose_logs").insert({
          care_profile_id: schedule.care_profile_id,
          medication_id: med.id,
          schedule_id: schedule.id,
          dose_identity: doseIdentity,
          scheduled_date: todayStr,
          scheduled_time: schedule.time_of_day,
          status: "unconfirmed",
        });
      } else if (existingDose.status !== "unconfirmed") {
        await supabase
          .from("dose_logs")
          .update({ status: "unconfirmed", updated_at: new Date().toISOString() })
          .eq("id", existingDose.id);
      }

      // Check if notification already generated (deduplication)
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("care_profile_id", schedule.care_profile_id)
        .eq("category", "unconfirmed_escalation")
        .contains("metadata", { dose_identity: doseIdentity })
        .maybeSingle();

      if (existingNotif) {
        continue; // Already notified and escalated
      }

      const personName = careProfile.preferred_name || careProfile.full_name;
      const alertTitle = `Unconfirmed Dose: ${med.name} (${med.dosage})`;
      const alertMsg = `${personName}'s scheduled ${med.name} (${med.dosage}) at ${schedule.time_of_day.slice(0, 5)} has not been confirmed after ${Math.round(elapsedMinutes)} minutes.`;

      // Fetch active circle members eligible for alerts
      const { data: alertMembers } = await supabase
        .from("care_members")
        .select(`
          user_id,
          role,
          receive_email_alerts,
          profiles (
            id,
            email,
            full_name
          )
        `)
        .eq("care_profile_id", schedule.care_profile_id)
        .eq("status", "active")
        .eq("receive_email_alerts", true);

      // Create in-app escalation notification
      const { data: newNotif, error: notifErr } = await supabase
        .from("notifications")
        .insert({
          care_profile_id: schedule.care_profile_id,
          category: "unconfirmed_escalation",
          title: alertTitle,
          message: alertMsg,
          priority: "urgent",
          status: "pending",
          email_status: resendApiKey ? "pending" : "none",
          metadata: {
            dose_identity: doseIdentity,
            medication_id: med.id,
            medication_name: med.name,
            dosage: med.dosage,
            scheduled_time: schedule.time_of_day,
            scheduled_date: todayStr,
            elapsed_minutes: Math.round(elapsedMinutes),
          },
        })
        .select("id")
        .single();

      if (notifErr) {
        result.errors.push(`Failed to insert notification: ${notifErr.message}`);
        continue;
      }

      result.notificationsCreated++;
      result.escalatedDoses.push(doseIdentity);

      // Create timeline entry
      await supabase.from("activity_logs").insert({
        care_profile_id: schedule.care_profile_id,
        actor_name: "Care Intelligence System",
        actor_role: "system",
        activity_type: "dose_unconfirmed_escalated",
        description: `Automated follow-up triggered for ${personName}'s ${med.name} dose (${schedule.time_of_day.slice(0, 5)}).`,
        metadata: { dose_identity: doseIdentity, notification_id: newNotif.id },
      });

      // Send Resend Emails if API key is provided
      if (resendApiKey && alertMembers && alertMembers.length > 0) {
        for (const member of alertMembers) {
          const profile = member.profiles as any;
          if (!profile?.email) continue;

          try {
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
                <div style="text-align: center; font-size: 12px; color: #717770;">
                  This is an automated safety reminder from CareCircle.
                </div>
              </div>
            `;

            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "CareCircle Alerts <alerts@resend.dev>",
                to: [profile.email],
                subject: `CareCircle Alert: Unconfirmed dose for ${personName}`,
                html: emailHtml,
              }),
            });

            if (res.ok) {
              result.emailsSent++;
              await supabase
                .from("notifications")
                .update({
                  email_status: "sent",
                  email_recipient: profile.email,
                  email_sent_at: new Date().toISOString(),
                })
                .eq("id", newNotif.id);
            } else {
              const errBody = await res.text();
              result.emailsFailed++;
              result.errors.push(`Resend error for ${profile.email}: ${errBody}`);
              await supabase
                .from("notifications")
                .update({
                  email_status: "failed",
                  email_error: errBody,
                })
                .eq("id", newNotif.id);
            }
          } catch (emailErr: any) {
            result.emailsFailed++;
            result.errors.push(`Email send exception: ${emailErr.message}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Escalation check complete.", result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, result }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
