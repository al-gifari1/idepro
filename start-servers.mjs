import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runServer(name, command, args, options) {
    console.log(`[Launcher] Starting ${name}...`);
    const proc = spawn(command, args, {
        shell: true,
        stdio: "inherit",
        ...options
    });

    proc.on("error", (err) => {
        console.error(`[Launcher] Failed to start ${name}:`, err);
    });

    proc.on("exit", (code) => {
        console.log(`[Launcher] ${name} exited with code ${code}`);
    });

    return proc;
}

// 1. Sync Server (port 3000)
const syncServer = runServer(
    "Sync Server",
    "node",
    [path.join("web_controller", "server", "server.mjs")],
    { cwd: __dirname }
);

// 2. Login Portal (port 5173)
const loginPortal = runServer(
    "Login Portal",
    "npm",
    ["run", "dev"],
    { cwd: path.join(__dirname, "web") }
);

// 3. Admin Panel (port 5174)
const adminPanel = runServer(
    "Admin Panel",
    "npm",
    ["run", "dev", "--", "--port", "5174"],
    { cwd: path.join(__dirname, "web_controller", "admin-panel") }
);

// Keep launcher process alive
console.log("🚀 All servers launched successfully!");
process.stdin.resume();

process.on("SIGINT", () => {
    console.log("Shutting down servers...");
    syncServer.kill();
    loginPortal.kill();
    adminPanel.kill();
    process.exit();
});
