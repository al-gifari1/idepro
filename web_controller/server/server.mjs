import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from clouflare-worker/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../cloudflare-worker/.env") });

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Secret key for authorization (matching package patches)
const SECRET_KEY = "super-secret-hacker-key";
const DB_FILE = "./db.json";

// Initialize Supabase Client using service role bypass
const supabaseUrl = process.env.SUPABASE_URL || "https://rjegmurqhkglyethgauq.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not defined in cloudflare-worker/.env!");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Initial local db fallback state
let db = {
    users: [],
    activeAccounts: []
};

// Load database from file if exists
if (existsSync(DB_FILE)) {
    try {
        db = JSON.parse(readFileSync(DB_FILE, "utf8"));
        console.log("💾 Loaded cached database from db.json");
    } catch (err) {
        console.error("Error reading database file:", err.message);
    }
}

const saveDb = () => {
    try {
        writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving database file:", err.message);
    }
};

// Middleware to check authorization header
const checkAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${SECRET_KEY}`) {
        console.warn(`[Server] Unauthorized request from ${req.ip}`);
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};

// GET /api/accounts - Client app polls this to fetch the accounts list synced with Supabase
app.get("/api/accounts", checkAuth, async (req, res) => {
    try {
        const syncedAccounts = [];
        for (const acc of db.activeAccounts) {
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("id, tier, gmail_limit")
                .eq("email", acc.email)
                .single();

            if (profile && !error) {
                const { count } = await supabase
                    .from("user_gmail_assignments")
                    .select("gmail_id", { count: "exact", head: true })
                    .eq("user_id", profile.id);

                syncedAccounts.push({
                    email: acc.email,
                    tier: profile.tier,
                    gmailLimit: profile.gmail_limit,
                    activeGmailCount: count || 0,
                    token: acc.token
                });
            } else {
                syncedAccounts.push(acc);
            }
        }
        res.json(syncedAccounts);
    } catch (err) {
        console.error(`[Server] Failed to sync accounts from Supabase: ${err.message}`);
        res.json(db.activeAccounts);
    }
});

// POST /api/signup - Local account registration via Supabase
app.post("/api/signup", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    email_confirm: true
                }
            }
        });
        if (error) throw error;
        
        console.log(`[Server] New user registered via Supabase: ${email}`);
        res.json({ success: true, message: "Registration successful" });
    } catch (err) {
        console.error(`[Server] Supabase signup error: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/login - Local account sign-in via Supabase
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        const user = data.user;
        const session = data.session;

        // Fetch user profiles to sync plan details
        const { data: profile } = await supabase
            .from("profiles")
            .select("tier, gmail_limit")
            .eq("id", user.id)
            .single();

        const userTier = profile?.tier || "free";
        const gmailLimit = profile?.gmail_limit || 1;

        const tokenPayload = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiryDateSeconds: Math.floor(Date.now() / 1000) + session.expires_in,
            tokenType: "Bearer",
            isGcpTos: false
        };

        const activeAcc = {
            email: user.email,
            tier: userTier,
            gmailLimit,
            token: tokenPayload
        };

        const idx = db.activeAccounts.findIndex(a => a.email === user.email);
        if (idx >= 0) {
            db.activeAccounts[idx] = activeAcc;
        } else {
            db.activeAccounts.push(activeAcc);
        }
        saveDb();

        console.log(`[Server] User logged in via Supabase: ${user.email} (${userTier.toUpperCase()})`);
        res.json({
            success: true,
            email: user.email,
            tier: userTier,
            gmailLimit,
            token: tokenPayload
        });
    } catch (err) {
        console.error(`[Server] Supabase login error: ${err.message}`);
        res.status(401).json({ error: err.message });
    }
});

// GET /api/users - Admin command to list users
app.get("/api/users", checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error(`[Server] Failed to fetch users: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/update-tier - Admin command to toggle user tier
app.post("/api/update-tier", checkAuth, async (req, res) => {
    const { email, tier, gmailLimit } = req.body;
    if (!email || !tier) {
        return res.status(400).json({ error: "Missing email or tier" });
    }

    try {
        const { data: profile, error: fetchErr } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .single();
        if (fetchErr || !profile) throw new Error("User profile not found");

        const updateData = { tier, updated_at: new Date().toISOString() };
        if (gmailLimit !== undefined) {
            updateData.gmail_limit = parseInt(gmailLimit) || 1;
        }

        const { error: updateErr } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", profile.id);
        if (updateErr) throw updateErr;

        // If user is currently logged in, update cached details
        const activeIdx = db.activeAccounts.findIndex(a => a.email.toLowerCase() === email.toLowerCase());
        if (activeIdx >= 0) {
            db.activeAccounts[activeIdx].tier = tier;
            if (gmailLimit !== undefined) {
                db.activeAccounts[activeIdx].gmailLimit = parseInt(gmailLimit) || 1;
            }
        }
        saveDb();

        console.log(`[Server] Updated tier for ${email} to ${tier.toUpperCase()}`);
        res.json({ success: true, email, tier });
    } catch (err) {
        console.error(`[Server] Failed to update tier: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/add-account - Legacy fallback sync support
app.post("/api/add-account", (req, res) => {
    const { email, token } = req.body;
    if (!email || !token) {
        return res.status(400).json({ error: "Missing email or token" });
    }
    
    const idx = db.activeAccounts.findIndex(a => a.email === email);
    if (idx >= 0) {
        db.activeAccounts[idx].token = token;
    } else {
        db.activeAccounts.push({ email, tier: "premium", gmailLimit: 5, token });
    }
    saveDb();
    res.json({ success: true, count: db.activeAccounts.length });
});

// GET / - Root landing page
app.get("/", (req, res) => {
    res.send(`
        <body style="background: #0d0e15; color: #10b981; font-family: monospace; padding: 50px;">
            <h1>[ IDEpro CENTRAL AUTH & SYNC SERVER ACTIVE ]</h1>
            <p>Environment: Local Development</p>
            <p>Supabase Url: ${supabaseUrl}</p>
            <p>Active Synced Sessions: ${db.activeAccounts.length}</p>
        </body>
    `);
});

app.listen(port, () => {
    console.log(`=============================================`);
    console.log(`🏴‍☠️ IDEpro Sync Server Running with Supabase!`);
    console.log(`🔗 URL: http://localhost:${port}`);
    console.log(`=============================================`);
});
