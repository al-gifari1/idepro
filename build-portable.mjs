/**
 * build-portable.mjs
 * Builds a portable IDEpro ZIP from:
 *   - src/           (patched source)
 *   - Electron binary from installed Antigravity IDE
 *
 * Output: dist/IDEpro-Portable.zip
 *
 * Steps:
 *   1. Pack src/ → dist/resources/app.asar  (using @electron/asar)
 *   2. Copy Electron binary + DLLs → dist/
 *   3. Rename electron binary → IDEpro.exe
 *   4. Zip dist/ → IDEpro-Portable.zip
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC_DIR          = path.join(__dirname, "package", "resources", "app");
const DIST_DIR          = path.join(__dirname, "dist", "IDEpro");
const ELECTRON_DIR     = "C:\\Users\\Open Pc\\AppData\\Local\\Programs\\Antigravity IDE";
const OUTPUT_ZIP       = path.join(__dirname, "dist", "IDEpro-Portable.zip");

// ─── Step 0: Clean dist ───────────────────────────────────────────────────────
console.log("🧹 Cleaning dist...");
if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true });
mkdirSync(path.join(DIST_DIR, "resources"), { recursive: true });

// ─── Step 1: Pack app.asar ────────────────────────────────────────────────────
console.log("📦 Packing app.asar...");
const asarOut = path.join(DIST_DIR, "resources", "app.asar");
execSync(`npx --yes @electron/asar pack "${SRC_DIR}" "${asarOut}"`, {
    stdio: "inherit",
    cwd: __dirname,
});
console.log("✅ app.asar packed");

// ─── Step 2: Copy app.asar.unpacked (native modules) ─────────────────────────
const unpackedSrc = path.join(ELECTRON_DIR, "resources", "app.asar.unpacked");
if (existsSync(unpackedSrc)) {
    console.log("📋 Copying app.asar.unpacked...");
    cpSync(unpackedSrc, path.join(DIST_DIR, "resources", "app.asar.unpacked"), { recursive: true });
}

// ─── Step 3: Copy Electron binary + all DLLs/files ────────────────────────────
console.log("🔧 Copying Electron runtime...");

// Copy everything EXCEPT the original exe and uninstaller
const skipFiles = new Set(["Antigravity IDE.exe", "unins000.exe", "unins000.dat"]);
const entries = readdirSync(ELECTRON_DIR);

for (const entry of entries) {
    if (skipFiles.has(entry)) continue;
    const src = path.join(ELECTRON_DIR, entry);
    const dst = path.join(DIST_DIR, entry);
    const stat = statSync(src);
    if (stat.isDirectory()) {
        cpSync(src, dst, { recursive: true });
    } else {
        copyFileSync(src, dst);
    }
}

// ─── Step 4: Rename/copy electron EXE → IDEpro.exe ───────────────────
console.log("📝 Renaming EXE to IDEpro.exe...");
copyFileSync(
    path.join(ELECTRON_DIR, "Antigravity IDE.exe"),
    path.join(DIST_DIR, "IDEpro.exe")
);

// ─── Step 5: Create ZIP ────────────────────────────────────────────────────────
console.log("🗜️  Creating ZIP...");
if (existsSync(OUTPUT_ZIP)) rmSync(OUTPUT_ZIP);

// Use PowerShell Compress-Archive
execSync(
    `powershell -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${OUTPUT_ZIP}' -Force"`,
    { stdio: "inherit" }
);

console.log("\n✅ Done!");
console.log(`📦 Output: ${OUTPUT_ZIP}`);
console.log(`📁 Portable folder: ${DIST_DIR}`);
console.log(`\n💡 To run directly: ${DIST_DIR}\\IDEpro.exe`);
