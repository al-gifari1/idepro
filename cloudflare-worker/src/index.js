import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-license-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
};

// Simple AES-GCM encrypt/decrypt for credential data stored in Supabase
async function encryptData(text, secretKey) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encoded, secretKey) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, "AES-GCM", false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Pick the best available AI session (least used, active)
async function pickAISession(supabase) {
  const now = new Date().toISOString();
  // Auto-recover sessions whose rate_limit_until has passed
  await supabase
    .from("google_ai_sessions")
    .update({ status: "active" })
    .eq("status", "rate_limited")
    .lt("rate_limit_until", now);

  const { data, error } = await supabase
    .from("google_ai_sessions")
    .select("id, gmail, auth_method, credential_data, requests_today")
    .eq("status", "active")
    .order("requests_today", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    const supabaseUrl = env.SUPABASE_URL || "https://rjegmurqhkglyethgauq.supabase.co";
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZWdtdXJxaGtnbHlldGhnYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTIxMzYsImV4cCI6MjA5OTU2ODEzNn0.6Qf0ZDlU_bSBPCXG_4lvs5rZFBYndjfDJh3_k3K6tYw";
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const encryptionSecret = env.SESSION_ENCRYPTION_KEY || "idepro-default-secret-key-change";
    const telegramToken = env.TELEGRAM_BOT_TOKEN || "";
    const telegramChatId = env.TELEGRAM_ADMIN_CHAT_ID || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Telegram alert helper
    async function sendTelegramAlert(message) {
      if (!telegramToken || !telegramChatId) return;
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChatId, text: message, parse_mode: "HTML" }),
      });
    }

    try {
      // ── HEALTH CHECK ──────────────────────────────────────────────────────────
      if (path === "/health" || path === "/") {
        const { count } = await supabase
          .from("google_ai_sessions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");
        return new Response(
          JSON.stringify({
            status: "online",
            gateway: "Cloudflare Edge Worker",
            timestamp: new Date().toISOString(),
            ai_sessions_active: count || 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── AI PROXY ──────────────────────────────────────────────────────────────
      // POST /api/ai-proxy — Core session-pooled AI request router
      if (path === "/api/ai-proxy" && request.method === "POST") {
        const body = await request.json();
        const { prompt, model = "gemini-2.0-flash", license_key, user_email } = body;

        if (!prompt) {
          return new Response(JSON.stringify({ error: "prompt is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 1. Validate user license key
        if (license_key) {
          const { data: sessionRow } = await supabase
            .from("active_sessions")
            .select("email, tier, ai_requests_today, ai_requests_limit")
            .eq("access_token", license_key)
            .single();

          if (!sessionRow) {
            return new Response(JSON.stringify({ error: "Invalid license key" }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // 2. Check per-user daily limit
          const limit = sessionRow.tier === "premium" ? 1000 : sessionRow.tier === "pro" ? 200 : 20;
          const usedToday = sessionRow.ai_requests_today || 0;
          if (usedToday >= limit) {
            return new Response(
              JSON.stringify({ error: "Daily AI request limit reached. Upgrade your plan.", tier: sessionRow.tier, limit }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // 3. Pick least-used AI session from pool
        const aiSession = await pickAISession(supabase);
        if (!aiSession) {
          await sendTelegramAlert("🚨 <b>IDEpro Alert</b>: ALL Google AI sessions are exhausted or rate-limited! Add more accounts in the Admin Panel.");
          return new Response(JSON.stringify({ error: "AI service temporarily unavailable. All sessions exhausted." }), {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 4. Decrypt credential and call Google AI
        const credential = await decryptData(aiSession.credential_data, encryptionSecret);
        const startTime = Date.now();
        let aiResponse, aiText, errorCode;

        try {
          const googleRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${credential}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );

          if (googleRes.status === 429) {
            errorCode = "rate_limited";
            // Mark session as rate-limited for 1 hour
            const rateLimitUntil = new Date(Date.now() + 3600 * 1000).toISOString();
            await supabase
              .from("google_ai_sessions")
              .update({ status: "rate_limited", rate_limit_until: rateLimitUntil, updated_at: new Date().toISOString() })
              .eq("id", aiSession.id);
            await sendTelegramAlert(`⚠️ <b>IDEpro</b>: <code>${aiSession.gmail}</code> hit rate limit — rotating to next session.`);

            // Retry with another session
            const fallbackSession = await pickAISession(supabase);
            if (!fallbackSession) {
              return new Response(JSON.stringify({ error: "All AI sessions rate-limited. Try again later." }), {
                status: 503,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            const fallbackCred = await decryptData(fallbackSession.credential_data, encryptionSecret);
            const fallbackRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${fallbackCred}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
              }
            );
            aiResponse = await fallbackRes.json();
          } else {
            aiResponse = await googleRes.json();
          }

          aiText = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (googleErr) {
          errorCode = "error";
          aiText = "";
        }

        const responseMs = Date.now() - startTime;

        // 5. Increment session usage counter
        await supabase
          .from("google_ai_sessions")
          .update({
            requests_today: aiSession.requests_today + 1,
            requests_total: supabase.rpc ? undefined : undefined, // incremented separately
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", aiSession.id);

        // 6. Log usage
        await supabase.from("ai_usage_logs").insert({
          session_id: aiSession.id,
          user_email: user_email || null,
          model,
          prompt_preview: prompt.slice(0, 100),
          response_ok: !errorCode,
          response_ms: responseMs,
          error_code: errorCode || null,
        });

        return new Response(
          JSON.stringify({ text: aiText, model, session_id: aiSession.id, response_ms: responseMs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── ADMIN: SESSION MANAGEMENT ─────────────────────────────────────────────
      // GET /api/admin/sessions — list all AI sessions (admin only)
      if (path === "/api/admin/sessions" && request.method === "GET") {
        const adminKey = request.headers.get("x-admin-key");
        if (adminKey !== env.ADMIN_SECRET_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data } = await supabase
          .from("google_ai_sessions")
          .select("id, gmail, display_name, auth_method, status, requests_today, requests_total, last_used_at, rate_limit_until, notes, created_at")
          .order("created_at", { ascending: false });
        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // POST /api/admin/sessions — add new AI session
      if (path === "/api/admin/sessions" && request.method === "POST") {
        const adminKey = request.headers.get("x-admin-key");
        if (adminKey !== env.ADMIN_SECRET_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const body = await request.json();
        const { gmail, display_name, auth_method = "apikey", credential, notes } = body;

        if (!gmail || !credential) {
          return new Response(JSON.stringify({ error: "gmail and credential are required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const encrypted = await encryptData(credential, encryptionSecret);
        const { data, error } = await supabase.from("google_ai_sessions").insert({
          gmail, display_name, auth_method, credential_data: encrypted, notes,
        }).select("id, gmail, status").single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, session: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DELETE /api/admin/sessions/:id — remove session
      if (path.startsWith("/api/admin/sessions/") && request.method === "DELETE") {
        const adminKey = request.headers.get("x-admin-key");
        if (adminKey !== env.ADMIN_SECRET_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const sessionId = path.split("/").pop();
        await supabase.from("google_ai_sessions").delete().eq("id", sessionId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // PATCH /api/admin/sessions/:id/status — disable/enable session
      if (path.match(/\/api\/admin\/sessions\/.+\/status/) && request.method === "PATCH") {
        const adminKey = request.headers.get("x-admin-key");
        if (adminKey !== env.ADMIN_SECRET_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const sessionId = path.split("/")[4];
        const body = await request.json();
        await supabase
          .from("google_ai_sessions")
          .update({ status: body.status, updated_at: new Date().toISOString() })
          .eq("id", sessionId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── EXISTING ROUTES (preserved) ───────────────────────────────────────────
      if (path === "/api/accounts" && request.method === "GET") {
        const { data, error } = await supabase
          .from("active_sessions")
          .select("*")
          .order("last_synced_at", { ascending: false });
        if (error) throw error;
        const accounts = (data || []).map((row) => ({
          email: row.email, tier: row.tier, gmailLimit: row.gmail_limit,
          activeGmailCount: row.active_gmail_count,
          token: { accessToken: row.access_token, refreshToken: row.refresh_token || "", tokenType: "Bearer", expiryDateSeconds: Math.floor(Date.now() / 1000) + 86400 },
        }));
        return new Response(JSON.stringify(accounts), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=2" } });
      }

      if (path === "/api/webhook" && request.method === "POST") {
        const payload = await request.json();
        console.log("[Webhook Received]:", payload);
        return new Response(JSON.stringify({ success: true, processed_at: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/api/update-tier" && request.method === "POST") {
        const body = await request.json();
        const { email, tier, gmailLimit } = body;
        if (!email || !tier) return new Response(JSON.stringify({ error: "Email and tier required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("profiles").update({ tier, gmail_limit: gmailLimit, updated_at: new Date().toISOString() }).eq("email", email);
        await supabase.from("active_sessions").update({ tier, gmail_limit: gmailLimit, last_synced_at: new Date().toISOString() }).eq("email", email);
        return new Response(JSON.stringify({ success: true, email, tier, gmailLimit }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/api/login" && request.method === "POST") {
        const body = await request.json();
        const { email, password } = body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const user = data.user;
        const session = data.session;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        const userTier = profile?.tier || "free";
        const gmailLimit = profile?.gmail_limit || 1;
        await supabase.from("active_sessions").upsert({ email: user.email, access_token: session.access_token, refresh_token: session.refresh_token, tier: userTier, gmail_limit: gmailLimit, last_synced_at: new Date().toISOString() }, { onConflict: "email" });
        return new Response(JSON.stringify({ success: true, email: user.email, tier: userTier, gmailLimit, token: { accessToken: session.access_token, refreshToken: session.refresh_token } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "Endpoint not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Internal Worker Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },
};
