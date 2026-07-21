import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: Retrieve active sessions list (for IDE Desktop Client polling)
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("active_sessions")
        .select("*")
        .order("last_synced_at", { ascending: false });

      if (error) throw error;

      // Map DB rows to client payload structure
      const accounts = (data || []).map((row) => ({
        email: row.email,
        tier: row.tier,
        gmailLimit: row.gmail_limit,
        activeGmailCount: row.active_gmail_count,
        token: {
          accessToken: row.access_token,
          refreshToken: row.refresh_token || "",
          tokenType: "Bearer",
          expiryDateSeconds: Math.floor(Date.now() / 1000) + 86400,
        },
      }));

      return new Response(JSON.stringify(accounts), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // POST: Update tier or sync session
    if (req.method === "POST") {
      const body = await req.json();

      if (action === "update-tier") {
        const { email, tier, gmailLimit } = body;
        if (!email || !tier) {
          return new Response(JSON.stringify({ error: "Email and tier required" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        // Update profiles table
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ tier, gmail_limit: gmailLimit, updated_at: new Date().toISOString() })
          .eq("email", email);

        if (profileErr) throw profileErr;

        // Also update active_sessions table
        await supabase
          .from("active_sessions")
          .update({ tier, gmail_limit: gmailLimit, last_synced_at: new Date().toISOString() })
          .eq("email", email);

        return new Response(JSON.stringify({ success: true, email, tier, gmailLimit }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Default POST: Sync session token
      const { email, token, tier, gmailLimit } = body;
      if (!email || !token) {
        return new Response(JSON.stringify({ error: "Missing email or token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const accessToken = typeof token === "string" ? token : token.accessToken;
      const refreshToken = typeof token === "object" ? token.refreshToken : "";

      const { data, error } = await supabase
        .from("active_sessions")
        .upsert(
          {
            email,
            access_token: accessToken,
            refresh_token: refreshToken,
            tier: tier || "free",
            gmail_limit: gmailLimit || 1,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        )
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, session: data[0] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal Edge Function Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
