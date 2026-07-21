import os
import sys
import json
import uuid

# Set console encoding to UTF-8 on Windows to avoid UnicodeEncodeError for emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.join(root_dir, "package", "resources", "app")

    if not os.path.exists(app_dir):
        print(f"❌ Error: Local package directory not found at {app_dir}", file=sys.stderr)
        sys.exit(1)

    print("🚀 Starting patching process on local package (Python Edition)...")

    # --------------------------------------------------------------------------
    # 1. Product & Package identity metadata
    # --------------------------------------------------------------------------
    product_path = os.path.join(app_dir, "product.json")
    if os.path.exists(product_path):
        try:
            with open(product_path, "r", encoding="utf-8-sig") as f:
                product = json.load(f)

            new_guid_x64 = f"{{{str(uuid.uuid4()).upper()}}}"
            new_guid_arm64 = f"{{{str(uuid.uuid4()).upper()}}}"
            new_guid_x64_user = f"{{{str(uuid.uuid4()).upper()}}}"
            new_guid_arm_user = f"{{{str(uuid.uuid4()).upper()}}}"

            patches = {
                "nameShort": "IDEpro",
                "nameLong": "IDEpro",
                "applicationName": "idepro",
                "aliasName": "idepro",
                "dataFolderName": ".idepro",
                "win32MutexName": "idepro",
                "win32DirName": "IDEpro",
                "win32NameVersion": "IDEpro",
                "win32RegValueName": "IDEpro",
                "win32x64AppId": new_guid_x64,
                "win32arm64AppId": new_guid_arm64,
                "win32x64UserAppId": new_guid_x64_user,
                "win32arm64UserAppId": new_guid_arm_user,
                "win32AppUserModelId": "Google.IDEpro",
                "win32ShellNameShort": "IDEpro",
                "win32TunnelServiceMutex": "idepro-tunnelservice",
                "win32TunnelMutex": "idepro-tunnel",
                "linuxIconName": "idepro",
                "serverApplicationName": "idepro-server",
                "serverDataFolderName": ".idepro-server",
                "tunnelApplicationName": "idepro-tunnel",
                "urlProtocol": "idepro",
                "updateUrl": "",
            }

            product.update(patches)
            with open(product_path, "w", encoding="utf-8") as f:
                json.dump(product, f, indent="\t")
            print("✅ product.json identity patched")
        except Exception as e:
            print(f"❌ Error patching product.json: {e}", file=sys.stderr)
    else:
        print("⚠️ product.json not found")

    pkg_path = os.path.join(app_dir, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8-sig") as f:
                pkg = json.load(f)

            pkg["name"] = "idepro"
            pkg["productName"] = "IDEpro"

            with open(pkg_path, "w", encoding="utf-8") as f:
                json.dump(pkg, f, indent="\t")
            print("✅ package.json identity patched")
        except Exception as e:
            print(f"❌ Error patching package.json: {e}", file=sys.stderr)
    else:
        print("⚠️ package.json not found")

    # --------------------------------------------------------------------------
    # 2. Multi-account + Remote Sync UI (jetskiAgent/main.js)
    # --------------------------------------------------------------------------
    jetski_path = os.path.join(app_dir, "out", "jetskiAgent", "main.js")
    if os.path.exists(jetski_path):
        try:
            with open(jetski_path, "r", encoding="utf-8") as f:
                content = f.read()

            hook_target = 's==="signedIn"?p(Wd,{label:"Email",description:a?"Peter Pan":n.email,rightElement:p(lo,{onClick:async()=>{await t.logout(),g(),e({to:co.onboarding,replace:!0,search:{login:!0}})},children:"Sign Out"})}):p(Wd,{label:"Not Signed In",description:`Sign in to use ${Z7i.name}!`,rightElement:p(Eo,{onClick:()=>t.showLoginFlow(),children:"Sign In"})})]})}),'
            
            hook_replacement = """...(() => {
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
      if (existing) { existing.token = currentToken; } else { accounts.push(remoteAcc); }
      localStorage.setItem("idepro_accounts", JSON.stringify(accounts));
      setAllAccounts(accounts);
    }
  }, [s, n?.email, currentToken]);

  const handleSyncNow = async (urlVal = syncUrl, keyVal = syncKey) => {
    if (!urlVal) { setSyncStatus("Error: Sync URL is empty"); return; }
    setSyncStatus("Syncing...");
    try {
      const response = await fetch(urlVal, { method: "GET", headers: { "Authorization": `Bearer ${keyVal}`, "Content-Type": "application/json" } });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
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
      setSyncStatus(`Sync successful! Loaded ${data.length} accounts.`);
    } catch (err) { setSyncStatus(`Sync failed: ${err.message}`); }
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
    }) : [p(Wd, { label: "Not Signed In", description: `Sign in to use ${Z7i.name}!`, rightElement: p(Eo, { onClick: () => t.showLoginFlow(), children: "Sign In" }) })]),
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
  ]})}),"""

            if hook_target in content:
                content = content.replace(hook_target, hook_replacement)
                with open(jetski_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print("✅ Multi-account UI patched in jetskiAgent/main.js")
            elif "idepro_accounts" in content:
                print("ℹ️ jetskiAgent/main.js is already patched")
            else:
                print("⚠️ Multi-account hook target not found in jetskiAgent/main.js")
        except Exception as e:
            print(f"❌ Error patching jetskiAgent/main.js: {e}", file=sys.stderr)
    else:
        print("⚠️ jetskiAgent/main.js not found")

    # --------------------------------------------------------------------------
    # 3. Checksum, CSP, and Rebranding (workbench.desktop.main.js)
    # --------------------------------------------------------------------------
    workbench_path = os.path.join(app_dir, "out", "vs", "workbench", "workbench.desktop.main.js")
    if os.path.exists(workbench_path):
        try:
            with open(workbench_path, "r", encoding="utf-8") as f:
                content = f.read()

            changed = False

            # Checksum bypass
            checksum_target = "async _isPure(){const e=this.productService.checksums||{};await this.lifecycleService.when(4);const i=await Promise.all(Object.keys(e).map(r=>this._resolve(r,e[r])));let n=!0;for(let r=0,s=i.length;r<s;r++)if(!i[r].isPure){n=!1;break}return{isPure:n,proof:i}}"
            checksum_replacement = "async _isPure(){return{isPure:!0,proof:[]}}"
            if checksum_target in content:
                content = content.replace(checksum_target, checksum_replacement)
                print("✅ Checksum validation bypass injected in workbench.desktop.main.js")
                changed = True
            elif "isPure:!0" in content:
                print("ℹ️ Checksum validation is already bypassed")

            # CSP bypass
            csp_target = "connect-src https:;"
            csp_replacement = "connect-src https: http://localhost:3000 http://127.0.0.1:3000;"
            if csp_target in content:
                content = content.replace(csp_target, csp_replacement)
                print("✅ CSP connect-src policy bypassed in workbench.desktop.main.js")
                changed = True
            elif "connect-src https: http://localhost:3000" in content:
                print("ℹ️ CSP connect-src policy is already bypassed")

            # Text replacements
            if "Antigravity IDE" in content or "AntigravityPro" in content or "Antigravity Pro" in content:
                content = content.replace("Antigravity IDE", "IDEpro")
                content = content.replace("AntigravityPro", "IDEpro")
                content = content.replace("Antigravity Pro", "IDEpro")
                print("✅ Rebranded visual texts in workbench.desktop.main.js")
                changed = True

            # Welcome Screen Button
            if '"Continue with Antigravity"' in content:
                content = content.replace('"Continue with Antigravity"', '"Continue with IDEpro"')
                print("✅ Rebranded Welcome button text to 'Continue with IDEpro'")
                changed = True

            # Logo rebrand
            logo_start = 'Ewo=({className:t=""})=>C("div"'
            logo_clip = 'clip0_6153_71'
            logo_end = ']})})'
            start_idx = content.find(logo_start)
            if start_idx > -1:
                clip_idx = content.find(logo_clip, start_idx + 100)
                if clip_idx > -1:
                    end_idx = content.find(logo_end, clip_idx)
                    if end_idx > -1:
                        original_block = content[start_idx:end_idx + len(logo_end)]
                        custom_logo = 'Ewo=({className:t=""})=>C("div",{className:`w-full h-full relative \\${t}`,children:C("svg",{width:"100%",height:"100%",viewBox:"0 0 96 96",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[C("path",{d:"M30 25L10 48L30 71 M66 25L86 48L66 71 M43 78L53 18",stroke:"#00dcff",strokeWidth:"8",strokeLinecap:"round",strokeLinejoin:"round"}),C("path",{d:"M10 48H86",stroke:"#a78bfa",strokeWidth:"3",strokeDasharray:"6 6",opacity:"0.4"})]})})'
                        content = content.replace(original_block, custom_logo)
                        print("✅ Rebranded Welcome logo to code brackets")
                        changed = True
            
            # Welcome login form V1n replacement
            v1n_start = 'V1n=({productName:t,onSignIn:e,showGcpProjectOption:i,onGcpSignIn:n,onCopySignInUrl:r,onFeedback:s,isLoading:o=!1,isSuccess:a=!1,disableEntranceAnimation:l=!1})=>C(Ui'
            v1n_idx = content.find(v1n_start)
            if v1n_idx != -1:
                search_area = content[v1n_idx:v1n_idx + 3000]
                yxu_idx = search_area.find("Yxu=")
                if yxu_idx != -1:
                    full_target = search_area[:yxu_idx]
                    replacement = 'V1n=({productName:t,onSignIn:e,showGcpProjectOption:i,onGcpSignIn:n,onCopySignInUrl:r,onFeedback:s,isLoading:o=!1,isSuccess:a=!1,disableEntranceAnimation:l=!1})=>{let [email, setEmail] = gt("");let [password, setPassword] = gt("");let [isRegister, setIsRegister] = gt(false);let [error, setError] = gt("");let [success, setSuccess] = gt("");let [localLoading, setLocalLoading] = gt(false);const handleSubmit = async (ev) => {ev.preventDefault();setError("");setSuccess("");if (!email || !password) {setError("Email and password required.");return;}setLocalLoading(true);try {const endpoint = isRegister ? "signup" : "login";const res = await fetch(`http://localhost:3000/api/${endpoint}`, {method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify({ email, password })});const data = await res.json();if (!res.ok) {throw new Error(data.error || "Authentication failed.");}if (isRegister) {setSuccess("Account created! You can now log in.");setIsRegister(false);} else {setSuccess("Authenticated successfully!");if (e) {e();}}} catch (err) {setError(err.message);} finally {setLocalLoading(false);}};return C(Ui, {children: C("div", {className: "w-[360px] p-6 rounded-lg glass-panel z-10 flex flex-col gap-4",style: { background: "rgba(13, 14, 22, 0.85)", border: "1px solid rgba(0, 220, 255, 0.2)", color: "#fff", fontFamily: "monospace" },children: [C("div", {className: "text-center",children: [C("h1", { style: { fontSize: "18px", fontWeight: "bold", color: "#00dcff", margin: "0 0 4px" }, children: "IDEpro // PRO" }),C("p", { style: { fontSize: "10px", color: "#888", margin: 0 }, children: isRegister ? "REGISTER NEW WORKSPACE NODE" : "AUTHENTICATE CENTRAL ACCESS PORTAL" })]}),error && C("div", { style: { fontSize: "11px", color: "#ff4455", background: "rgba(255, 68, 85, 0.1)", border: "1px solid #ff4455", padding: "6px 10px" }, children: `[ERROR] ${error.toUpperCase()}` }),success && C("div", { style: { fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", padding: "6px 10px" }, children: `[OK] ${success.toUpperCase()}` }),C("form", {onSubmit: handleSubmit,className: "flex flex-col gap-3",children: [C("div", {className: "flex flex-col gap-1",children: [C("label", { style: { fontSize: "10px", color: "#00dcff" }, children: "SECURE EMAIL" }),C("input", {type: "email",value: email,onInput: (ev) => setEmail(ev.target.value),placeholder: "name@workspace.net",style: { width: "100%", padding: "8px 12px", background: "#030406", border: "1px solid #3c3c3c", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" }})]}),C("div", {className: "flex flex-col gap-1",children: [C("label", { style: { fontSize: "10px", color: "#00dcff" }, children: "SECURITY PASSPHRASE" }),C("input", {type: "password",value: password,onInput: (ev) => setPassword(ev.target.value),placeholder: "••••••••",style: { width: "100%", padding: "8px 12px", background: "#030406", border: "1px solid #3c3c3c", color: "#fff", fontSize: "12px", outline: "none", boxSizing: "border-box" }})]}),C("button", {type: "submit",disabled: localLoading || o,style: { width: "100%", padding: "10px", background: "rgba(0, 220, 255, 0.1)", border: "1px solid #00dcff", color: "#00dcff", fontSize: "12px", fontWeight: "bold", cursor: "pointer", marginTop: "8px" },children: localLoading || o ? "CONNECTING..." : isRegister ? "CREATE_SESSION_NODE" : "CONNECT_SECURE_LINK"}),C("div", {className: "text-center mt-2",style: { fontSize: "11px" },children: [C("span", { style: { color: "#888" }, children: isRegister ? "ALREADY INSTANTIATED? " : "NEW NODE REGISTRATION? " }),C("button", {type: "button",onClick: () => { setIsRegister(!isRegister); setError(""); setSuccess(""); },style: { background: "none", border: "none", color: "#00dcff", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "monospace", fontWeight: "bold" },children: isRegister ? "LOGIN" : "REGISTER_WORKSPACE"})]})]})]}})});},'
                    content = content.replace(full_target, replacement)
                    print("✅ Patched V1n Welcome component with native login form")
                    changed = True
            elif "CONNECT_SECURE_LINK" in content:
                print("ℹ️ V1n Welcome component is already patched with native form")

            if changed:
                with open(workbench_path, "w", encoding="utf-8") as f:
                    f.write(content)
        except Exception as e:
            print(f"❌ Error patching workbench.desktop.main.js: {e}", file=sys.stderr)
    else:
        print("⚠️ workbench.desktop.main.js not found")

    # --------------------------------------------------------------------------
    # 4. Auth Server Polling (main.js)
    # --------------------------------------------------------------------------
    main_js_path = os.path.join(app_dir, "out", "main.js")
    if os.path.exists(main_js_path):
        try:
            with open(main_js_path, "r", encoding="utf-8") as f:
                content = f.read()

            auth_target = 'async login(t){const r=await this.getLoginUrl(t);try{await u$s.openExternal(r)}catch(n){this.logger.error("Error opening login URL:",n),this._onDidOnboardUser.fire({errorType:"browserOpenFailed",isGcpTos:t}),this._authActor.send({type:"BROWSER_OPEN_FAILED"})}this.logger.info("[Auth] Login URL: ",r),this._oauthResponsePromise=new Promise(n=>{this._oauthResponseResolver=n});try{return await Promise.race([this._oauthResponsePromise,new Promise((n,a)=>setTimeout(()=>{a(new Error("Cancelled"))},10*60*1e3))])}finally{this._oauthResponseResolver=null,this._oauthResponsePromise=null}}'
            
            auth_replacement = ('async login(t){const http=require("http");const https=require("https");'
                                'const getAccount=()=>new Promise(resolve=>{'
                                'const supabaseFnUrl=process.env.SUPABASE_SYNC_URL || "http://localhost:3000/api/accounts";'
                                'const isHttps=supabaseFnUrl.startsWith("https");const client=isHttps?https:http;'
                                'const req=client.get(supabaseFnUrl,{ headers:{ Authorization: "Bearer super-secret-hacker-key" } },'
                                'res=>{let data="";res.on("data",chunk=>data+=chunk);res.on("end",()=>{try{const arr=JSON.parse(data);'
                                'if(Array.isArray(arr)&&arr.length>0)resolve(arr[0]);else if(arr&&arr.email)resolve(arr);else resolve(null);'
                                '}catch{resolve(null)}});});req.on("error",()=>resolve(null));req.end();});'
                                'this.logger.info("[Auth] Polling Supabase/Sync server — waiting for portal login...");'
                                'let account=null;for(let i=0;i<150;i++){account=await getAccount();'
                                'if(account&&account.token&&account.token.accessToken){'
                                'this.logger.info("[Auth] Credentials received:",account.email,"tier:",account.tier,"gmailLimit:",account.gmailLimit);break;}'
                                'await new Promise(r=>setTimeout(r,2000));}if(account&&account.token&&account.token.accessToken){'
                                'this._agLastTier=account.tier||"free";this._agLastGmailLimit=account.gmailLimit??1;return account.token.accessToken;}'
                                'throw new Error("Login timed out or failed — make sure Supabase or the sync server is active.");}')

            if auth_target in content:
                content = content.replace(auth_target, auth_replacement)
                with open(main_js_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print("✅ login() patch applied in main.js")
            elif "Polling Supabase/Sync server" in content:
                print("ℹ️ login() in main.js is already patched")
            else:
                print("⚠️ login() target not found in main.js")
        except Exception as e:
            print(f"❌ Error patching main.js: {e}", file=sys.stderr)
    else:
        print("⚠️ main.js not found")

    # --------------------------------------------------------------------------
    # 5. Extension: Provider rebrand & slot limitation (extension.js)
    # --------------------------------------------------------------------------
    ext_path = os.path.join(app_dir, "extensions", "antigravity", "dist", "extension.js")
    if os.path.exists(ext_path):
        try:
            with open(ext_path, "r", encoding="utf-8") as f:
                content = f.read()

            changed = False

            # Auth label provider
            auth_lbl_target = ',"Google Auth",this'
            auth_lbl_replacement = ',"IDEpro",this'
            if auth_lbl_target in content:
                content = content.replace(auth_lbl_target, auth_lbl_replacement)
                print("✅ Auth provider label patched in extension.js")
                changed = True

            # getSessions method
            sessions_target = 'async getSessions(){const e=await i.antigravityUnifiedStateSync.OAuthPreferences.getOAuthTokenInfo();if(!e)return[];const t=await i.antigravityUnifiedStateSync.UserStatus.getUserStatus();if(!t)return[];const n=(0,c.P2)(t,r.dZ7),{email:o,name:l}=n;return""===o?[]:[{id:`antigravity-${o}`,accessToken:e.accessToken,account:{id:o,label:l},scopes:[]}]}'
            
            sessions_replacement = ('async getSessions(){const e=await i.antigravityUnifiedStateSync.OAuthPreferences.getOAuthTokenInfo();'
                                    'if(!e)return[];const t=await i.antigravityUnifiedStateSync.UserStatus.getUserStatus();if(!t)return[];'
                                    'const n=(0,c.P2)(t,r.dZ7),{email:o,name:l}=n;if(""===o)return[];let tier="free",gmailLimit=1,activeGmailCount=0;'
                                    'try{const http=require("http");const accounts=await new Promise(resolve=>{'
                                    'const req=http.request({hostname:"localhost",port:3000,path:"/api/accounts",method:"GET",headers:{Authorization:"Bearer super-secret-hacker-key"}},'
                                    'res=>{let data="";res.on("data",chunk=>data+=chunk);res.on("end",()=>{try{resolve(JSON.parse(data))}catch{resolve([])}});});'
                                    'req.on("error",()=>resolve([]));req.end();});'
                                    'const match=accounts.find(a=>a.email&&a.email.toLowerCase()===o.toLowerCase());'
                                    'if(match){tier=match.tier||"free";gmailLimit=match.gmailLimit??1;activeGmailCount=match.activeGmailCount??0;}}catch(err){}'
                                    'const TIER_LABELS={free:"FREE",pro:"PRO",premium:"PREMIUM"};const tierLabel=TIER_LABELS[tier]||tier.toUpperCase();'
                                    'if(activeGmailCount>=gmailLimit){try{const vsc=require("vscode");'
                                    'vsc.window.showErrorMessage("[IDEpro] Gmail limit reached — " + tierLabel + " plan allows " + gmailLimit + " account(s) per session. Upgrade your plan to add more.","Upgrade Plan").then(sel=>{if(sel==="Upgrade Plan")vsc.env.openExternal(vsc.Uri.parse("http://localhost:5173"));});'
                                    '}catch(_){}return[];}const slotLabel=o + " (" + tierLabel + " — " + (activeGmailCount+1) + "/" + gmailLimit + " Gmail slots)";'
                                    'return[{id:"antigravity-" + o,accessToken:e.accessToken,account:{id:o,label:slotLabel},scopes:[]}];}')

            if sessions_target in content:
                content = content.replace(sessions_target, sessions_replacement)
                print("✅ getSessions() method patched in extension.js")
                changed = True
            elif "slotLabel" in content:
                print("ℹ️ getSessions() in extension.js is already patched")

            # Settings migration bypass
            migration_target = "async function c(e){const t=function(){"
            migration_replacement = "async function c(e){return;const t=function(){"
            if migration_target in content:
                content = content.replace(migration_target, migration_replacement)
                print("✅ Settings migration bypassed in extension.js")
                changed = True
            elif "async function c(e){return;const t=" in content:
                print("ℹ️ Settings migration already bypassed")

            if changed:
                with open(ext_path, "w", encoding="utf-8") as f:
                    f.write(content)
        except Exception as e:
            print(f"❌ Error patching extension.js: {e}", file=sys.stderr)
    else:
        print("⚠️ extension.js not found")

    # --------------------------------------------------------------------------
    # 6. Translations Rebranding (nls.messages.json)
    # --------------------------------------------------------------------------
    nls_path = os.path.join(app_dir, "out", "nls.messages.json")
    if os.path.exists(nls_path):
        try:
            with open(nls_path, "r", encoding="utf-8") as f:
                nls = json.load(f)

            count = 0
            new_nls = []
            for item in nls:
                if isinstance(item, str):
                    replaced = item
                    if "Antigravity IDE" in replaced:
                        replaced = replaced.replace("Antigravity IDE", "IDEpro")
                        count += 1
                    if "AntigravityPro" in replaced:
                        replaced = replaced.replace("AntigravityPro", "IDEpro")
                        count += 1
                    if "Antigravity Pro" in replaced:
                        replaced = replaced.replace("Antigravity Pro", "IDEpro")
                        count += 1
                    if "Antigravity" in replaced:
                        replaced = replaced.replace("Antigravity", "IDEpro")
                        count += 1
                    new_nls.append(replaced)
                else:
                    new_nls.append(item)

            if count > 0:
                with open(nls_path, "w", encoding="utf-8") as f:
                    json.dump(new_nls, f, ensure_ascii=False)
                print(f"✅ Rebranded {count} translation strings in nls.messages.json")
            else:
                print("ℹ️ nls.messages.json is already rebranded")
        except Exception as e:
            print(f"❌ Error patching nls.messages.json: {e}", file=sys.stderr)
    else:
        print("⚠️ nls.messages.json not found")

    # --------------------------------------------------------------------------
    # 7. Welcome Page Onboarding Text rebrand
    # --------------------------------------------------------------------------
    paths_to_rebrand = [
        os.path.join(app_dir, "out", "main.js"),
        os.path.join(app_dir, "out", "jetskiAgent", "main.js")
    ]
    target_btn = '"Continue with Google"'
    replacement_btn = '"Continue to Workspace"'

    for path_btn in paths_to_rebrand:
        if os.path.exists(path_btn):
            try:
                with open(path_btn, "r", encoding="utf-8") as f:
                    content = f.read()
                if target_btn in content:
                    content = content.replace(target_btn, replacement_btn)
                    with open(path_btn, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"✅ Patched onboarding button text in: ${path_btn}")
            except Exception as e:
                print(f"❌ Failed to patch onboarding button in {path_btn}: {e}", file=sys.stderr)

    print("🎉 Consolidation & Package patching completed successfully!")

if __name__ == "__main__":
    main()
