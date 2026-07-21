import { readFileSync, writeFileSync } from "node:fs";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "package", "resources", "app", "extensions", "antigravity", "dist", "extension.js");

let content = readFileSync(filePath, "utf8");
let changed = false;

// ──────────────────────────────────────────────────────────────────────────────
// PATCH 1: Auth provider display label
// ──────────────────────────────────────────────────────────────────────────────
const authTarget      = ',"Google Auth",this';
const authReplacement = ',"IDEpro",this';

if (content.includes(authTarget)) {
  content = content.replace(authTarget, authReplacement);
  console.log("✅ [1] Auth provider label → 'IDEpro'");
  changed = true;
} else {
  console.warn("⚠️  [1] Auth label target not found (already patched?)");
}

// ──────────────────────────────────────────────────────────────────────────────
// PATCH 2: getSessions() — fetch tier, gmailLimit, enforce slot limit
// ──────────────────────────────────────────────────────────────────────────────
const sessionsTarget =
  'async getSessions(){const e=await i.antigravityUnifiedStateSync.OAuthPreferences.getOAuthTokenInfo();if(!e)return[];const t=await i.antigravityUnifiedStateSync.UserStatus.getUserStatus();if(!t)return[];const n=(0,c.P2)(t,r.dZ7),{email:o,name:l}=n;return""===o?[]:[{id:`antigravity-${o}`,accessToken:e.accessToken,account:{id:o,label:l},scopes:[]}]}';

const sessionsReplacement =
  `async getSessions(){
    const e=await i.antigravityUnifiedStateSync.OAuthPreferences.getOAuthTokenInfo();
    if(!e)return[];
    const t=await i.antigravityUnifiedStateSync.UserStatus.getUserStatus();
    if(!t)return[];
    const n=(0,c.P2)(t,r.dZ7),{email:o,name:l}=n;
    if(""===o)return[];

    let tier="free",gmailLimit=1,activeGmailCount=0;
    try{
      const http=require("http");
      const accounts=await new Promise(resolve=>{
        const req=http.request({
          hostname:"localhost",
          port:3000,
          path:"/api/accounts",
          method:"GET",
          headers:{Authorization:"Bearer super-secret-hacker-key"}
        },res=>{
          let data="";
          res.on("data",chunk=>data+=chunk);
          res.on("end",()=>{
            try{resolve(JSON.parse(data))}catch{resolve([])}
          });
        });
        req.on("error",()=>resolve([]));
        req.end();
      });
      const match=accounts.find(a=>a.email&&a.email.toLowerCase()===o.toLowerCase());
      if(match){
        tier=match.tier||"free";
        gmailLimit=match.gmailLimit??1;
        activeGmailCount=match.activeGmailCount??0;
      }
    }catch(err){}

    const TIER_LABELS={free:"FREE",pro:"PRO",premium:"PREMIUM"};
    const tierLabel=TIER_LABELS[tier]||tier.toUpperCase();

    if(activeGmailCount>=gmailLimit){
      try{
        const vsc=require("vscode");
        vsc.window.showErrorMessage(
          "[IDEpro] Gmail limit reached — " + tierLabel + " plan allows " + gmailLimit + " account(s) per session. Upgrade your plan to add more.",
          "Upgrade Plan"
        ).then(sel=>{
          if(sel==="Upgrade Plan")vsc.env.openExternal(vsc.Uri.parse("http://localhost:5173"));
        });
      }catch(_){}
      return[];
    }

    const slotLabel=o + " (" + tierLabel + " — " + (activeGmailCount+1) + "/" + gmailLimit + " Gmail slots)";

    return[{
      id:"antigravity-" + o,
      accessToken:e.accessToken,
      account:{id:o,label:slotLabel},
      scopes:[]
    }];
  }`.replace(/\n\s*/g, "");

if (content.includes(sessionsTarget)) {
  content = content.replace(sessionsTarget, sessionsReplacement);
  console.log("✅ [2] getSessions() patched — tier display + Gmail slot enforcement");
  changed = true;
} else {
  console.warn("⚠️  [2] getSessions() target not found (already patched? check exact string)");
}

// ──────────────────────────────────────────────────────────────────────────────
// PATCH 3: Settings migration bypass
// ──────────────────────────────────────────────────────────────────────────────
const migrationTarget = "async function c(e){const t=function(){";
const migrationReplacement = "async function c(e){return;const t=function(){";

if (content.includes(migrationTarget)) {
  content = content.replace(migrationTarget, migrationReplacement);
  console.log("✅ [3] Settings migration bypassed");
  changed = true;
} else if (content.includes("async function c(e){return;const t=")) {
  console.log("ℹ️  [3] Settings migration already bypassed");
} else {
  console.warn("⚠️  [3] Settings migration target not found");
}

// ──────────────────────────────────────────────────────────────────────────────
// Write back
// ──────────────────────────────────────────────────────────────────────────────
if (changed) {
  writeFileSync(filePath, content, "utf8");
  console.log("🚀 Extension patches written to extension.js");
} else {
  console.log("ℹ️  No changes written (nothing matched).");
}
