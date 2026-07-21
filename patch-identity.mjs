/**
 * patch-identity.mjs
 * Patches product.json and package.json to give IDEpro its own identity.
 * Run AFTER copying extracted_src → src/
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "package", "resources", "app");

// ─── product.json ────────────────────────────────────────────────────────────
const productPath = path.join(srcDir, "product.json");
const product = JSON.parse(readFileSync(productPath, "utf8").replace(/^\uFEFF/, ""));

const newGuidX64     = `{${randomUUID().toUpperCase()}}`;
const newGuidArm64   = `{${randomUUID().toUpperCase()}}`;
const newGuidX64User = `{${randomUUID().toUpperCase()}}`;
const newGuidArmUser = `{${randomUUID().toUpperCase()}}`;

const patches = {
    nameShort:            "IDEpro",
    nameLong:             "IDEpro",
    applicationName:      "idepro",
    aliasName:            "idepro",
    dataFolderName:       ".idepro",
    win32MutexName:       "idepro",
    win32DirName:         "IDEpro",
    win32NameVersion:     "IDEpro",
    win32RegValueName:    "IDEpro",
    win32x64AppId:        newGuidX64,
    win32arm64AppId:      newGuidArm64,
    win32x64UserAppId:    newGuidX64User,
    win32arm64UserAppId:  newGuidArmUser,
    win32AppUserModelId:  "Google.IDEpro",
    win32ShellNameShort:  "IDEpro",
    win32TunnelServiceMutex: "idepro-tunnelservice",
    win32TunnelMutex:     "idepro-tunnel",
    linuxIconName:        "idepro",
    serverApplicationName: "idepro-server",
    serverDataFolderName:  ".idepro-server",
    tunnelApplicationName: "idepro-tunnel",
    urlProtocol:           "idepro",
    // Disable update URL so it never contacts update server
    updateUrl:            "",
};

Object.assign(product, patches);
writeFileSync(productPath, JSON.stringify(product, null, "\t"));
console.log("✅ product.json patched");

// ─── package.json ─────────────────────────────────────────────────────────────
const pkgPath = path.join(srcDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8").replace(/^\uFEFF/, ""));

pkg.name        = "idepro";
pkg.productName = "IDEpro";

writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t"));
console.log("✅ package.json patched");

console.log("\nNew GUIDs generated:");
console.log("  x64:     ", newGuidX64);
console.log("  arm64:   ", newGuidArm64);
console.log("  x64User: ", newGuidX64User);
console.log("  armUser: ", newGuidArmUser);
