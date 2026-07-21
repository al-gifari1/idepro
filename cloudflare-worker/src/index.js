import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize Supabase Client on Cloudflare Edge
    const supabaseUrl = env.SUPABASE_URL || "https://rjegmurqhkglyethgauq.supabase.co";
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZWdtdXJxaGtnbHlldGhnYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTIxMzYsImV4cCI6MjA5OTU2ODEzNn0.6Qf0ZDlU_bSBPCXG_4lvs5rZFBYndjfDJh3_k3K6tYw";
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
      // 2. Health check route
      if (path === "/health" || path === "/") {
        return new Response(
          JSON.stringify({
            status: "online",
            gateway: "Cloudflare Edge Worker",
            timestamp: new Date().toISOString(),
            supabase_target: supabaseUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. GET /api/accounts - IDE Desktop Client polling endpoint
      if (path === "/api/accounts" && request.method === "GET") {
        const { data, error } = await supabase
          .from("active_sessions")
          .select("*")
          .order("last_synced_at", { ascending: false });

        if (error) throw error;

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
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=2",
          },
        });
      }

      // 4. POST /api/webhook - Real-time Supabase DB Webhook Receiver
      if (path === "/api/webhook" && request.method === "POST") {
        const payload = await request.json();
        console.log("[Cloudflare Worker Webhook Received]:", payload);

        // Process profile / session updates asynchronously on Edge
        return new Response(
          JSON.stringify({ success: true, processed_at: new Date().toISOString(), event: payload.type || "DB_UPDATE" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 5. POST /api/update-tier - Admin Tier Management
      if (path === "/api/update-tier" && request.method === "POST") {
        const body = await request.json();
        const { email, tier, gmailLimit } = body;

        if (!email || !tier) {
          return new Response(JSON.stringify({ error: "Email and tier required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        });
      }

      // 6. POST /api/login - Proxy/Authenticate User via Supabase Auth
      if (path === "/api/login" && request.method === "POST") {
        const body = await request.json();
        const { email, password } = body;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const user = data.user;
        const session = data.session;

        // Fetch user profile from Supabase
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        const userTier = profile?.tier || "free";
        const gmailLimit = profile?.gmail_limit || 1;

        // Upsert into active_sessions table
        await supabase.from("active_sessions").upsert(
          {
            email: user.email,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            tier: userTier,
            gmail_limit: gmailLimit,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

        return new Response(
          JSON.stringify({
            success: true,
            email: user.email,
            tier: userTier,
            gmailLimit,
            token: {
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Internal Worker Error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
