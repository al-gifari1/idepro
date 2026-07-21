import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Secret key for authorization
const SECRET_KEY = "super-secret-hacker-key";
const DB_FILE = "./db.json";

// Initial mock database state
let db = {
    users: [
        { email: "premium-user@idepro.pro", password: "password123", tier: "premium" },
        { email: "free-user@idepro.pro", password: "password123", tier: "free" }
    ],
    activeAccounts: []
};

// Load database from file if exists
if (existsSync(DB_FILE)) {
    try {
        db = JSON.parse(readFileSync(DB_FILE, "utf8"));
        console.log("💾 Loaded database from db.json");
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

// GET /api/accounts - Client app polls this to fetch the accounts list
app.get("/api/accounts", checkAuth, (req, res) => {
    res.json(db.activeAccounts);
});

// POST /api/signup - Local account registration
app.post("/api/signup", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }

    const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        return res.status(400).json({ error: "Account already exists" });
    }

    const newUser = { email: email.toLowerCase(), password, tier: "free" };
    db.users.push(newUser);
    saveDb();

    console.log(`[Server] New user registered: ${email}`);
    res.json({ success: true, message: "Registration successful" });
});

// POST /api/login - Local account sign-in
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }

    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate a mock access token for this session
    const mockAccessToken = `idepro-token-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    const tokenPayload = {
        accessToken: mockAccessToken,
        refreshToken: `refresh-${Math.random().toString(36).substring(2, 15)}`,
        expiryDateSeconds: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        tokenType: "Bearer",
        isGcpTos: false
    };

    // Add or update active account in sync queue
    const activeAcc = {
        email: user.email,
        tier: user.tier,
        token: tokenPayload
    };

    const idx = db.activeAccounts.findIndex(a => a.email === user.email);
    if (idx >= 0) {
        db.activeAccounts[idx] = activeAcc;
    } else {
        db.activeAccounts.push(activeAcc);
    }
    saveDb();

    console.log(`[Server] User logged in: ${user.email} (${user.tier.toUpperCase()})`);
    res.json({
        success: true,
        email: user.email,
        tier: user.tier,
        token: tokenPayload
    });
});

// GET /api/users - Admin command to list users
app.get("/api/users", checkAuth, (req, res) => {
    res.json(db.users);
});

// POST /api/update-tier - Admin command to toggle user tier
app.post("/api/update-tier", checkAuth, (req, res) => {
    const { email, tier } = req.body;
    if (!email || !tier) {
        return res.status(400).json({ error: "Missing email or tier" });
    }

    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    user.tier = tier;

    // If user is currently logged in, update their active session tier as well
    const activeIdx = db.activeAccounts.findIndex(a => a.email.toLowerCase() === email.toLowerCase());
    if (activeIdx >= 0) {
        db.activeAccounts[activeIdx].tier = tier;
    }
    saveDb();

    console.log(`[Server] Updated tier for ${email} to ${tier.toUpperCase()}`);
    res.json({ success: true, email, tier });
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
        db.activeAccounts.push({ email, tier: "premium", token });
    }
    saveDb();
    res.json({ success: true, count: db.activeAccounts.length });
});

// GET / - Root landing page
app.get("/", (req, res) => {
    res.send(`
        <body style="background: #0d0e15; color: #00dcff; font-family: monospace; padding: 50px;">
            <h1>[ IDEpro CENTRAL AUTH & SYNC SERVER ACTIVE ]</h1>
            <p>Port: ${port}</p>
            <p>Registered Users: ${db.users.length}</p>
            <p>Active Synced Sessions: ${db.activeAccounts.length}</p>
        </body>
    `);
});

app.listen(port, () => {
    console.log(`=============================================`);
    console.log(`🏴‍☠️ IDEpro Sync Server Running!`);
    console.log(`🔗 URL: http://localhost:${port}`);
    console.log(`🔑 Secret Key: ${SECRET_KEY}`);
    console.log(`=============================================`);
});
