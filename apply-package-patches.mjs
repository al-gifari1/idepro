/**
 * apply-package-patches.mjs
 * Applies all necessary patches directly to the local project's package/resources/app files.
 * Includes:
 *   1. Multi-account + Remote Sync UI (jetskiAgent/main.js)
 *   2. Checksum bypass + Visual rebranding (workbench.desktop.main.js)
 *   3. Translation rebranding (nls.messages.json)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "package", "resources", "app");

if (!existsSync(appDir)) {
  console.error(`❌ Error: Local package directory not found at ${appDir}`);
  process.exit(1);
}

console.log("🚀 Starting patching process on local package...");

// ─── 1. Multi-account + Remote Sync UI (jetskiAgent/main.js) ───────────────────
const jetskiPath = path.join(appDir, "out", "jetskiAgent", "main.js");
if (existsSync(jetskiPath)) {
  let content = readFileSync(jetskiPath, "utf8");
  
  const hookTarget = `s==="signedIn"?p(Wd,{label:"Email",description:a?"Peter Pan":n.email,rightElement:p(lo,{onClick:async()=>{await t.logout(),g(),e({to:co.onboarding,replace:!0,search:{login:!0}})},children:"Sign Out"})}):p(Wd,{label:"Not Signed In",description:\`Sign in to use \${Z7i.name}!\`,rightElement:p(Eo,{onClick:()=>t.showLoginFlow(),children:"Sign In"})})]})}),`;

  const hookReplacement = `...(() => {
  const [allAccounts, setAllAccounts] = ke(() => {
    try { return JSON.parse(localStorage.getItem("idepro_accounts") || "[]"); } catch { return []; }
  });
  const [syncUrl, setSyncUrl] = ke(() => localStorage.getItem("idepro_sync_url") || "");
  const [syncKey, setSyncKey] = ke(() => localStorage.getItem("idepro_sync_key") || "");
  const [syncStatus, setSyncStatus] = ke("Click Sync Now to sync accounts");
  const currentToken = dti?.() || null;

  tt(() => {
    if (s === "signedIn" && n?.email && currentToken) {
      let accounts = [];
      try { accounts = JSON.parse(localStorage.getItem("idepro_accounts") || "[]"); } catch {}
      if (!Array.isArray(accounts)) accounts = [];
      let existing = accounts.find(acc => acc.email === n.email);
      if (existing) { existing.token = currentToken; } else { accounts.push({ email: n.email, token: currentToken }); }
      localStorage.setItem("idepro_accounts", JSON.stringify(accounts));
      setAllAccounts(accounts);
    }
  }, [s, n?.email, currentToken]);

  const handleSyncNow = async (urlVal = syncUrl, keyVal = syncKey) => {
    if (!urlVal) { setSyncStatus("Error: Sync URL is empty"); return; }
    setSyncStatus("Syncing...");
    try {
      const response = await fetch(urlVal, { method: "GET", headers: { "Authorization": \`Bearer \${keyVal}\`, "Content-Type": "application/json" } });
      if (!response.ok) throw new Error(\`Server returned \${response.status}\`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid response format");
      let accounts = [];
      try { accounts = JSON.parse(localStorage.getItem("idepro_accounts") || "[]"); } catch {}
      if (!Array.isArray(accounts)) accounts = [];
      data.forEach(remoteAcc => {
        if (remoteAcc.email && remoteAcc.token) {
          let existing = accounts.find(acc => acc.email === remoteAcc.email);
          if (existing) { existing.token = remoteAcc.token; } else { accounts.push(remoteAcc); }
        }
      });
      localStorage.setItem("idepro_accounts", JSON.stringify(accounts));
      setAllAccounts(accounts);
      setSyncStatus(\`Sync successful! Loaded \${data.length} accounts.\`);
    } catch (err) { setSyncStatus(\`Sync failed: \${err.message}\`); }
  };

  tt(() => {
    if (syncUrl) {
      handleSyncNow(syncUrl, syncKey);
      const interval = setInterval(() => handleSyncNow(syncUrl, syncKey), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [syncUrl, syncKey]);

  const handleSwitchAccount = async (targetAcc) => { cti().pushUpdate(targetAcc.token); await t.refreshUserStatus(); };
  const handleRemoveAccount = (emailToRemove) => {
    let accounts = allAccounts.filter(acc => acc.email !== emailToRemove);
    localStorage.setItem("idepro_accounts", JSON.stringify(accounts));
    setAllAccounts(accounts);
  };

  return [
    ...(s === "signedIn" ? allAccounts.map(acc => {
      const isActive = acc.email === n.email;
      return p(Wd, { label: acc.email, description: isActive ? "Active Account" : "Saved Account",
        rightElement: p("div", { className: "flex items-center gap-2", children: [
          !isActive && p(Eo, { onClick: () => handleSwitchAccount(acc), children: "Switch" }),
          p(lo, { onClick: () => { if (isActive) { t.logout(); g(); e({ to: co.onboarding, replace: true, search: { login: true } }); } handleRemoveAccount(acc.email); }, children: isActive ? "Sign Out" : "Remove" })
        ]})
      });
    }) : [p(Wd, { label: "Not Signed In", description: \`Sign in to use \${Z7i.name}!\`, rightElement: p(Eo, { onClick: () => t.showLoginFlow(), children: "Sign In" }) })]),
    s === "signedIn" && p(Wd, { label: "Add Account", description: "Sign in with another account", rightElement: p(Eo, { onClick: () => t.loginWithRedirect({ isGcpTos: false }), children: "Add more account" }) }),
    s === "signedIn" && p("div", { style: { padding: "8px 0" }, children: [
      p(Wd, { label: "Sync API URL", description: "Remote backend sync URL",
        rightElement: p("input", { type: "text", value: syncUrl, onInput: ev => { setSyncUrl(ev.target.value); localStorage.setItem("idepro_sync_url", ev.target.value); }, placeholder: "https://your-backend.com/api/get-tokens", style: { backgroundColor: "#2d2d2d", color: "#fff", border: "1px solid #3c3c3c", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", width: "250px" } }) }),
      p(Wd, { label: "Sync Secret Key", description: "Authorization token",
        rightElement: p("input", { type: "password", value: syncKey, onInput: ev => { setSyncKey(ev.target.value); localStorage.setItem("idepro_sync_key", ev.target.value); }, placeholder: "Secret key", style: { backgroundColor: "#2d2d2d", color: "#fff", border: "1px solid #3c3c3c", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", width: "250px" } }) }),
      p(Wd, { label: "Database Remote Sync", description: syncStatus,
        rightElement: p(Eo, { onClick: () => handleSyncNow(syncUrl, syncKey), children: "Sync Now" }) })
    ]})
  ];
  })();
  ]})}),`;

  if (content.includes(hookTarget)) {
    content = content.replace(hookTarget, hookReplacement);
    writeFileSync(jetskiPath, content, "utf8");
    console.log("✅ Multi-account + Remote Sync UI patched in jetskiAgent/main.js");
  } else if (content.includes("idepro_accounts")) {
    console.log("ℹ️  jetskiAgent/main.js is already patched");
  } else {
    console.warn("⚠️  Multi-account hook target not found in jetskiAgent/main.js");
  }
} else {
  console.error("❌ jetskiAgent/main.js not found!");
}

// ─── 2. Checksum Bypass + Visual Rebranding (workbench.desktop.main.js) ────────
const workbenchPath = path.join(appDir, "out", "vs", "workbench", "workbench.desktop.main.js");
if (existsSync(workbenchPath)) {
  let content = readFileSync(workbenchPath, "utf8");
  
  const checksumTarget = "async _isPure(){const e=this.productService.checksums||{};await this.lifecycleService.when(4);const i=await Promise.all(Object.keys(e).map(r=>this._resolve(r,e[r])));let n=!0;for(let r=0,s=i.length;r<s;r++)if(!i[r].isPure){n=!1;break}return{isPure:n,proof:i}}";
  const checksumReplacement = "async _isPure(){return{isPure:!0,proof:[]}}";
  
  let changed = false;
  if (content.includes(checksumTarget)) {
    content = content.replace(checksumTarget, checksumReplacement);
    console.log("✅ Checksum validation bypass injected in workbench.desktop.main.js");
    changed = true;
  } else if (content.includes("isPure:!0")) {
    console.log("ℹ️  Checksum validation is already bypassed");
  }

  // CSP bypass: allow fetching http://localhost:3000 and http://127.0.0.1:3000
  const cspTarget = "connect-src https:;";
  const cspReplacement = "connect-src https: http://localhost:3000 http://127.0.0.1:3000;";
  if (content.includes(cspTarget)) {
    content = content.replaceAll(cspTarget, cspReplacement);
    console.log("✅ CSP connect-src policy bypassed in workbench.desktop.main.js");
    changed = true;
  } else if (content.includes("connect-src https: http://localhost:3000")) {
    console.log("ℹ️  CSP connect-src policy is already bypassed");
  } else {
    console.warn("⚠️  CSP connect-src policy target not found in workbench.desktop.main.js");
  }

  // Visual text replacements
  const beforeLen = content.length;
  if (content.includes("Antigravity IDE") || content.includes("AntigravityPro") || content.includes("Antigravity Pro")) {
    content = content.replaceAll("Antigravity IDE", "IDEpro");
    content = content.replaceAll("AntigravityPro", "IDEpro");
    content = content.replaceAll("Antigravity Pro", "IDEpro");
    console.log(`✅ Rebranded visual texts in workbench.desktop.main.js (${beforeLen} -> ${content.length} chars)`);
    changed = true;
  }

  // Welcome Screen: Replace "Continue with Antigravity" button text
  if (content.includes('"Continue with Antigravity"')) {
    content = content.replaceAll('"Continue with Antigravity"', '"Continue with IDEpro"');
    console.log("✅ Rebranded Welcome button text to 'Continue with IDEpro'");
    changed = true;
  }

  const startIdx = content.indexOf('Ewo=({className:t=""})=>C("div"');
  const clipIdx = content.indexOf('clip0_6153_71', startIdx + 100);
  const endKey = ']})})';

  if (startIdx > -1 && clipIdx > -1) {
    const endIdx = content.indexOf(endKey, clipIdx);
    if (endIdx > -1) {
      const originalBlock = content.substring(startIdx, endIdx + endKey.length);
      const customLogoReplacement = 'Ewo=({className:t=""})=>C("div",{className:`w-full h-full relative \\${t}`,children:C("svg",{width:"100%",height:"100%",viewBox:"0 0 96 96",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[C("path",{d:"M30 25L10 48L30 71 M66 25L86 48L66 71 M43 78L53 18",stroke:"#00dcff",strokeWidth:"8",strokeLinecap:"round",strokeLinejoin:"round"}),C("path",{d:"M10 48H86",stroke:"#a78bfa",strokeWidth:"3",strokeDasharray:"6 6",opacity:"0.4"})]})})';
      content = content.replace(originalBlock, customLogoReplacement);
      console.log("✅ Rebranded Welcome orange logo to modern cyan/purple code brackets");
      changed = true;
    }
  } else {
    console.log("⚠️ Could not locate Ewo logo block dynamically (already replaced?)");
  }

  // Welcome Screen: Replace V1n components with direct secure login form
  const v1nStartStr = 'V1n=({productName:t,onSignIn:e,showGcpProjectOption:i,onGcpSignIn:n,onCopySignInUrl:r,onFeedback:s,isLoading:o=!1,isSuccess:a=!1,disableEntranceAnimation:l=!1})=>C(Ui';
  const v1nIdx = content.indexOf(v1nStartStr);
  if (v1nIdx !== -1) {
    const searchArea = content.slice(v1nIdx, v1nIdx + 3000);
    const yxuIdx = searchArea.indexOf("Yxu=");
    if (yxuIdx !== -1) {
      const fullTarget = searchArea.slice(0, yxuIdx);
      const replacement = 'V1n=({productName:t,onSignIn:e,showGcpProjectOption:i,onGcpSignIn:n,onCopySignInUrl:r,onFeedback:s,isLoading:o=!1,isSuccess:a=!1,disableEntranceAnimation:l=!1})=>{let [email, setEmail] = gt("");let [password, setPassword] = gt("");let [isRegister, setIsRegister] = gt(false);let [error, setError] = gt("");let [success, setSuccess] = gt("");let [localLoading, setLocalLoading] = gt(false);const handleSubmit = async (ev) => {ev.preventDefault();setError("");setSuccess("");if (!email || !password) {setError("Email and password required.");return;}setLocalLoading(true);try {const endpoint = isRegister ? "signup" : "login";const res = await fetch(`http://localhost:3000/api/${endpoint}`, {method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify({ email, password })});const data = await res.json();if (!res.ok) {throw new Error(data.error || "Authentication failed.");}if (isRegister) {setSuccess("Account created! You can now log in.");setIsRegister(false);} else {setSuccess("Authenticated successfully!");if (e) {e();}}} catch (err) {setError(err.message);} finally {setLocalLoading(false);}};return C(Ui, {children: C("div", {className: "w-[360px] p-6 rounded-lg glass-panel z-10 flex flex-col gap-4",style: { background: "rgba(13, 14, 22, 0.85)", border: "1px solid rgba(0, 220, 255, 0.2)", color: "#fff", fontFamily: "monospace" },children: [C("div", {className: "text-center",children: [C("h1", { style: { fontSize: "18px", fontWeight: "bold", color: "#00dcff", margin: "0 0 4px" }, children: "IDEpro // PRO" }),C("p", { style: { fontSize: "10px", color: "#888", margin: 0 }, children: isRegister ? "REGISTER NEW WORKSPACE NODE" : "AUTHENTICATE CENTRAL ACCESS PORTAL" })]}),error && C("div", { style: { fontSize: "11px", color: "#ff4455", background: "rgba(255, 68, 85, 0.1)", border: "1px solid #ff4455", padding: "6px 10px" }, children: `[ERROR] ${error.toUpperCase()}` }),success && C("div", { style: { fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", padding: "6px 10px" }, children: `[OK] ${success.toUpperCase()}` }),C("form", {onSubmit: handleSubmit,className: "flex flex-col gap-3",children: [C("div", {className: "flex flex-col gap-1",children: [C("label", { style: { fontSize: "10px", color: "#00dcff" }, children: "SECURE EMAIL" }),C("input", {type: "email",value: email,onInput: (ev) => setEmail(ev.target.value),placeholder: "name@workspace.net",style: { width: "100%", padding: "8px 12px", background: "#030406", border: "1px solid #3c3c3c", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" }})]}),C("div", {className: "flex flex-col gap-1",children: [C("label", { style: { fontSize: "10px", color: "#00dcff" }, children: "SECURITY PASSPHRASE" }),C("input", {type: "password",value: password,onInput: (ev) => setPassword(ev.target.value),placeholder: "••••••••",style: { width: "100%", padding: "8px 12px", background: "#030406", border: "1px solid #3c3c3c", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" }})]}),C("button", {type: "submit",disabled: localLoading || o,style: { width: "100%", padding: "10px", background: "rgba(0, 220, 255, 0.1)", border: "1px solid #00dcff", color: "#00dcff", fontSize: "12px", fontWeight: "bold", cursor: "pointer", marginTop: "8px" },children: localLoading || o ? "CONNECTING..." : isRegister ? "CREATE_SESSION_NODE" : "CONNECT_SECURE_LINK"}),C("div", {className: "text-center mt-2",style: { fontSize: "11px" },children: [C("span", { style: { color: "#888" }, children: isRegister ? "ALREADY INSTANTIATED? " : "NEW NODE REGISTRATION? " }),C("button", {type: "button",onClick: () => { setIsRegister(!isRegister); setError(""); setSuccess(""); },style: { background: "none", border: "none", color: "#00dcff", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "monospace", fontWeight: "bold" },children: isRegister ? "LOGIN" : "REGISTER_WORKSPACE"})]})]})]}})});},';
      content = content.replace(fullTarget, replacement);
      console.log("✅ Patched V1n Welcome component with native login form");
      changed = true;
    }
  } else if (content.includes("CONNECT_SECURE_LINK")) {
    console.log("ℹ️  V1n Welcome component is already patched with native form");
  } else {
    console.warn("⚠️  V1n Welcome component target not found in workbench.desktop.main.js");
  }

  if (changed) {
    writeFileSync(workbenchPath, content, "utf8");
  }
} else {
  console.error("❌ workbench.desktop.main.js not found!");
}

// ─── 3. Translation Rebranding (nls.messages.json) ───────────────────────────
const nlsPath = path.join(appDir, "out", "nls.messages.json");
if (existsSync(nlsPath)) {
  let nls = JSON.parse(readFileSync(nlsPath, "utf8"));
  let count = 0;
  nls = nls.map(str => {
    let temp = str;
    if (temp.includes("Antigravity IDE")) { temp = temp.replaceAll("Antigravity IDE", "IDEpro"); count++; }
    if (temp.includes("AntigravityPro")) { temp = temp.replaceAll("AntigravityPro", "IDEpro"); count++; }
    if (temp.includes("Antigravity Pro")) { temp = temp.replaceAll("Antigravity Pro", "IDEpro"); count++; }
    if (temp.includes("Antigravity")) { temp = temp.replaceAll("Antigravity", "IDEpro"); count++; }
    return temp;
  });
  writeFileSync(nlsPath, JSON.stringify(nls), "utf8");
  console.log(`✅ Rebranded ${count} translation strings in nls.messages.json`);
} else {
  console.error("❌ nls.messages.json not found!");
}

console.log("🎉 Local package patching complete!");
