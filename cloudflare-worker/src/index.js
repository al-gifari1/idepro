import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-license-key, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
};

// ── AES-GCM Encryption Helpers ───────────────────────────────────────────────
async function getKey(secret) {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyData, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(text, secret) {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded, secret) {
  const key = await getKey(secret);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// ── Token Refresh ─────────────────────────────────────────────────────────────
async function refreshGoogleToken(refreshToken, clientId, clientSecret) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Token refresh failed");
  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// ── Get fresh access token for a gmail_pool row ───────────────────────────────
async function getFreshAccessToken(supabase, gmailRow, encSecret, clientId, clientSecret) {
  const now = Date.now();
  // Token still valid (5 min buffer)?
  if (gmailRow.access_token && gmailRow.token_expires_at && gmailRow.token_expires_at > now + 300_000) {
    return gmailRow.access_token;
  }
  // Need refresh
  const refreshToken = await decrypt(gmailRow.encrypted_refresh_token, encSecret);
  const { access_token, expires_at } = await refreshGoogleToken(refreshToken, clientId, clientSecret);
  // Cache in DB
  await supabase
    .from("gmail_pool")
    .update({ access_token, token_expires_at: expires_at, updated_at: new Date().toISOString() })
    .eq("id", gmailRow.id);
  return access_token;
}

// ── Telegram Alert Helper ─────────────────────────────────────────────────────
async function tgAlert(token, chatId, msg) {
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
  }).catch(() => {});
}

// ── Validate User License ─────────────────────────────────────────────────────
async function validateLicense(supabase, licenseKey) {
  if (!licenseKey) return null;
  const { data } = await supabase
    .from("active_sessions")
    .select("email, tier")
    .eq("access_token", licenseKey)
    .single();
  return data || null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;

    // Route all non-API / non-health requests to static assets (SPA routing)
    const isApiRoute = path.startsWith("/api/");
    const isHealthCheck = path === "/health";
    const isJsonHome = path === "/" && (request.headers.get("accept") || "").includes("application/json");

    if (!isApiRoute && !isHealthCheck && !isJsonHome) {
      try {
        let assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status === 404) {
          // Fallback to root (index.html content) for React Router SPA to avoid 301 redirects
          const spaUrl = new URL("/", request.url);
          assetResponse = await env.ASSETS.fetch(new Request(spaUrl, request));
        }
        return assetResponse;
      } catch (e) {
        // Fallback for local testing without --assets bound
      }
    }

    // Config from Cloudflare secrets
    const SUPABASE_URL = env.SUPABASE_URL || "https://rjegmurqhkglyethgauq.supabase.co";
    const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || "";
    const ENC_SECRET   = env.SESSION_ENCRYPTION_KEY || "idepro-default-enc-key-change-me";
    const ADMIN_KEY    = env.ADMIN_SECRET_KEY || "idepro-admin-secret";
    const G_CLIENT_ID  = env.GOOGLE_CLIENT_ID || "";
    const G_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || "";
    const TG_TOKEN     = env.TELEGRAM_BOT_TOKEN || "";
    const TG_CHAT_ID   = env.TELEGRAM_ADMIN_CHAT_ID || "";
    const WORKER_URL   = "https://idepro.ai-gifari-n8n.workers.dev";

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const json  = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const isAdmin = () => request.headers.get("x-admin-key") === ADMIN_KEY;

    try {
      // ══════════════════════════════════════════════════════════════════
      // HEALTH CHECK
      // ══════════════════════════════════════════════════════════════════
      if (path === "/" || path === "/health") {
        const { count: activeGmails } = await supabase
          .from("gmail_pool").select("*", { count: "exact", head: true }).eq("status", "active");
        return json({ status: "online", gateway: "IDEpro Edge v3", timestamp: new Date().toISOString(), active_gmails: activeGmails || 0 });
      }

      // ══════════════════════════════════════════════════════════════════
      // OAUTH FLOW — Admin adds Gmail account via Google Login
      // ══════════════════════════════════════════════════════════════════

      // Step 1: Redirect admin to Google OAuth consent page
      // GET /api/oauth/start?display_name=xxx
      if (path === "/api/oauth/start" && request.method === "GET") {
        if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
        if (!G_CLIENT_ID) return json({ error: "GOOGLE_CLIENT_ID not configured. Set it via: npx wrangler secret put GOOGLE_CLIENT_ID" }, 500);

        const displayName = url.searchParams.get("display_name") || "";
        const state = btoa(JSON.stringify({ display_name: displayName, ts: Date.now() }));

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", G_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${WORKER_URL}/api/oauth/callback`);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/generative-language",
        ].join(" "));
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");  // Force refresh_token
        authUrl.searchParams.set("state", state);

        return Response.redirect(authUrl.toString(), 302);
      }

      // Step 2: Handle OAuth callback — exchange code for tokens
      // GET /api/oauth/callback?code=xxx&state=xxx
      if (path === "/api/oauth/callback" && request.method === "GET") {
        const code  = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return new Response(
            `<html><body style="font-family:monospace;background:#05070d;color:#ff4455;padding:40px">
              <h2>❌ OAuth Error: ${error}</h2>
              <p>Close this window and try again.</p>
            </body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }

        if (!code) return json({ error: "No authorization code received" }, 400);

        let displayName = "";
        try { displayName = JSON.parse(atob(state)).display_name || ""; } catch {}

        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: G_CLIENT_ID,
            client_secret: G_CLIENT_SECRET,
            redirect_uri: `${WORKER_URL}/api/oauth/callback`,
            grant_type: "authorization_code",
          }),
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.refresh_token) {
          return new Response(
            `<html><body style="font-family:monospace;background:#05070d;color:#ff4455;padding:40px">
              <h2>❌ Token Exchange Failed</h2>
              <pre>${JSON.stringify(tokenData, null, 2)}</pre>
              <p>Note: refresh_token only appears on first consent. Revoke access and try again.</p>
            </body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }

        // Get Gmail address from userinfo
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoRes.json();
        const gmail = userInfo.email;
        const name  = displayName || userInfo.name || gmail;

        // Encrypt refresh token before storing
        const encRefreshToken = await encrypt(tokenData.refresh_token, ENC_SECRET);
        const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

        // Upsert into gmail_pool
        const { error: dbErr } = await supabase.from("gmail_pool").upsert(
          {
            gmail,
            display_name: name,
            encrypted_refresh_token: encRefreshToken,
            access_token: tokenData.access_token,
            token_expires_at: expiresAt,
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "gmail" }
        );

        if (dbErr) {
          return new Response(
            `<html><body style="font-family:monospace;background:#05070d;color:#ff4455;padding:40px">
              <h2>❌ DB Error: ${dbErr.message}</h2>
            </body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }

        await tgAlert(TG_TOKEN, TG_CHAT_ID, `✅ <b>IDEpro</b>: New Gmail added to pool: <code>${gmail}</code> (${name})`);

        return new Response(
          `<html>
          <head><meta charset="UTF-8"><title>Gmail Added</title></head>
          <body style="font-family:monospace;background:#05070d;color:#00dcff;padding:40px;text-align:center">
            <h1 style="color:#10b981">✅ Gmail Successfully Added!</h1>
            <p style="color:#fff;font-size:18px"><strong>${gmail}</strong></p>
            <p style="color:#717a96">This account has been added to the IDEpro AI session pool.</p>
            <p style="color:#717a96;font-size:12px">You can close this window and return to the Admin Panel.</p>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'GMAIL_ADDED', gmail: '${gmail}' }, '*');
                  window.close();
                }
              }, 2000);
            </script>
          </body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      // ══════════════════════════════════════════════════════════════════
      // USER: Get assigned Gmail sessions (for IDEpro desktop sync)
      // GET /api/my-gmails  (requires x-license-key header)
      // ══════════════════════════════════════════════════════════════════
      if (path === "/api/my-gmails" && request.method === "GET") {
        const licenseKey = request.headers.get("x-license-key");
        const user = await validateLicense(supabase, licenseKey);
        if (!user) return json({ error: "Invalid license key" }, 401);

        // Get user_id from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, tier")
          .eq("email", user.email)
          .single();
        if (!profile) return json({ error: "Profile not found" }, 404);

        // Auto-assign if needed (idempotent)
        await supabase.rpc("auto_assign_gmails", { p_user_id: profile.id });

        // Fetch assigned gmails with pool info
        const { data: assignments } = await supabase
          .from("user_gmail_assignments")
          .select(`
            priority,
            gmail_pool (
              id, gmail, display_name, status,
              encrypted_refresh_token, access_token, token_expires_at
            )
          `)
          .eq("user_id", profile.id)
          .order("priority", { ascending: true });

        if (!assignments || assignments.length === 0) {
          return json({ gmails: [], message: "No gmails assigned. Contact admin." });
        }

        // Return fresh access tokens (refresh if needed)
        const result = [];
        for (const a of assignments) {
          const gp = a.gmail_pool;
          if (!gp || gp.status === "disabled") continue;

          let accessToken = gp.access_token;
          try {
            if (G_CLIENT_ID && G_CLIENT_SECRET) {
              accessToken = await getFreshAccessToken(supabase, gp, ENC_SECRET, G_CLIENT_ID, G_CLIENT_SECRET);
            }
          } catch (refreshErr) {
            // Mark as expired
            await supabase.from("gmail_pool").update({ status: "expired" }).eq("id", gp.id);
            await tgAlert(TG_TOKEN, TG_CHAT_ID, `🔴 <b>IDEpro</b>: <code>${gp.gmail}</code> token expired — re-auth needed`);
            continue;
          }

          result.push({
            priority: a.priority,
            gmail: gp.gmail,
            display_name: gp.display_name,
            status: gp.status,
            access_token: accessToken,
            expires_at: gp.token_expires_at,
          });
        }

        return json({ gmails: result, tier: profile.tier, total: result.length });
      }

      // ══════════════════════════════════════════════════════════════════
      // USER: Report a Gmail as rate-limited (auto-reassign next)
      // POST /api/report-limit  body: { gmail: "xxx@gmail.com" }
      // ══════════════════════════════════════════════════════════════════
      if (path === "/api/report-limit" && request.method === "POST") {
        const licenseKey = request.headers.get("x-license-key");
        const user = await validateLicense(supabase, licenseKey);
        if (!user) return json({ error: "Invalid license key" }, 401);

        const body = await request.json();
        const { gmail } = body;
        if (!gmail) return json({ error: "gmail field required" }, 400);

        // Mark gmail as rate_limited for 24h
        const rateLimitUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const { data: gmailRow } = await supabase.from("gmail_pool").select("id, gmail").eq("gmail", gmail).single();
        if (gmailRow) {
          await supabase.from("gmail_pool").update({
            status: "rate_limited",
            rate_limit_until: rateLimitUntil,
            updated_at: new Date().toISOString(),
          }).eq("id", gmailRow.id);

          // Remove from this user's assignments and re-assign
          const { data: profile } = await supabase.from("profiles").select("id").eq("email", user.email).single();
          if (profile) {
            await supabase.from("user_gmail_assignments")
              .delete()
              .eq("user_id", profile.id)
              .eq("gmail_id", gmailRow.id);
            // Trigger auto-assign to fill the gap
            await supabase.rpc("auto_assign_gmails", { p_user_id: profile.id });
          }

          await tgAlert(TG_TOKEN, TG_CHAT_ID, `⚡ <b>IDEpro</b>: <code>${gmail}</code> rate limited by user ${user.email}. Auto-rotating.`);
        }

        return json({ success: true, message: "Gmail marked rate-limited. Fetching /api/my-gmails will return updated list." });
      }

      // ══════════════════════════════════════════════════════════════════
      // ADMIN: List Gmail Pool
      // GET /api/admin/gmail-pool
      // ══════════════════════════════════════════════════════════════════
      if (path === "/api/admin/gmail-pool" && request.method === "GET") {
        if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
        const { data } = await supabase
          .from("gmail_pool")
          .select("id, gmail, display_name, status, requests_today, last_used_at, rate_limit_until, token_expires_at, notes, created_at")
          .order("created_at", { ascending: false });
        return json(data || []);
      }

      // ADMIN: Delete Gmail from pool
      // DELETE /api/admin/gmail-pool/:id
      if (path.startsWith("/api/admin/gmail-pool/") && request.method === "DELETE") {
        if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
        const id = path.split("/").pop();
        await supabase.from("gmail_pool").delete().eq("id", id);
        return json({ success: true });
      }

      // ADMIN: Toggle gmail status
      // PATCH /api/admin/gmail-pool/:id/status
      if (path.match(/\/api\/admin\/gmail-pool\/.+\/status/) && request.method === "PATCH") {
        if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
        const id = path.split("/")[4];
        const body = await request.json();
        await supabase.from("gmail_pool").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", id);
        return json({ success: true });
      }

      // ADMIN: Get OAuth login URL (popup redirect)
      // GET /api/admin/oauth-url?display_name=xxx
      if (path === "/api/admin/oauth-url" && request.method === "GET") {
        if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
        if (!G_CLIENT_ID) {
          return json({ error: "GOOGLE_CLIENT_ID not set. Run: npx wrangler secret put GOOGLE_CLIENT_ID", configured: false }, 500);
        }
        const displayName = url.searchParams.get("display_name") || "";
        const oauthStartUrl = `${WORKER_URL}/api/oauth/start?display_name=${encodeURIComponent(displayName)}&admin_key=${ADMIN_KEY}`;
        return json({ url: oauthStartUrl, configured: true });
      }

      // ADMIN: Manually re-assign gmails for all users
      // POST /api/admin/reassign-all
      if (path === "/api/admin/reassign-all" && request.method === "POST") {
        if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
        const { data: users } = await supabase.from("profiles").select("id");
        let count = 0;
        for (const u of users || []) {
          await supabase.rpc("auto_assign_gmails", { p_user_id: u.id });
          count++;
        }
        return json({ success: true, reassigned: count });
      }

      // ══════════════════════════════════════════════════════════════════
      // LEGACY ROUTES (preserved from v2)
      // ══════════════════════════════════════════════════════════════════
      if (path === "/api/accounts" && request.method === "GET") {
        const { data } = await supabase.from("active_sessions").select("*").order("last_synced_at", { ascending: false });
        const accounts = (data || []).map((r) => ({
          email: r.email, tier: r.tier, gmailLimit: r.gmail_limit, activeGmailCount: r.active_gmail_count,
          token: { accessToken: r.access_token, refreshToken: r.refresh_token || "", tokenType: "Bearer", expiryDateSeconds: Math.floor(Date.now() / 1000) + 86400 },
        }));
        return new Response(JSON.stringify(accounts), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=2" } });
      }

      if (path === "/api/login" && request.method === "POST") {
        const body = await request.json();
        const { email, password } = body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return json({ error: error.message }, 401);
        const user = data.user; const session = data.session;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        const userTier = profile?.tier || "free";
        const gmailLimit = profile?.gmail_limit || 1;
        await supabase.from("active_sessions").upsert(
          { email: user.email, access_token: session.access_token, refresh_token: session.refresh_token, tier: userTier, gmail_limit: gmailLimit, last_synced_at: new Date().toISOString() },
          { onConflict: "email" }
        );
        // Auto-assign gmails for this user
        if (profile?.id) {
          ctx.waitUntil(supabase.rpc("auto_assign_gmails", { p_user_id: profile.id }));
        }
        return json({ success: true, email: user.email, tier: userTier, gmailLimit, token: { accessToken: session.access_token, refreshToken: session.refresh_token } });
      }

      if (path === "/api/update-tier" && request.method === "POST") {
        const body = await request.json();
        const { email, tier, gmailLimit } = body;
        if (!email || !tier) return json({ error: "Email and tier required" }, 400);
        const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();
        await supabase.from("profiles").update({ tier, gmail_limit: gmailLimit, updated_at: new Date().toISOString() }).eq("email", email);
        await supabase.from("active_sessions").update({ tier, gmail_limit: gmailLimit, last_synced_at: new Date().toISOString() }).eq("email", email);
        // Re-assign gmails for new tier
        if (profile?.id) {
          ctx.waitUntil(supabase.rpc("auto_assign_gmails", { p_user_id: profile.id }));
        }
        return json({ success: true, email, tier, gmailLimit });
      }

      if (path === "/api/webhook" && request.method === "POST") {
        const payload = await request.json();
        console.log("[Webhook]:", payload);
        return json({ success: true });
      }

      return json({ error: "Endpoint not found" }, 404);

    } catch (err) {
      console.error("[Edge Worker Error]:", err);
      return json({ error: err.message || "Internal error" }, 500);
    }
  },
};
