import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "package", "resources", "app", "out", "main.js");

let content = readFileSync(filePath, "utf8");

// ──────────────────────────────────────────────────────────────────────────────
// PATCH: login() function — redirect to portal, poll Supabase Edge Function or
//        sync server, return accessToken + carry tier/gmailLimit downstream.
// ──────────────────────────────────────────────────────────────────────────────
const target =
  'async login(t){const r=await this.getLoginUrl(t);try{await u$s.openExternal(r)}catch(n){this.logger.error("Error opening login URL:",n),this._onDidOnboardUser.fire({errorType:"browserOpenFailed",isGcpTos:t}),this._authActor.send({type:"BROWSER_OPEN_FAILED"})}this.logger.info("[Auth] Login URL: ",r),this._oauthResponsePromise=new Promise(n=>{this._oauthResponseResolver=n});try{return await Promise.race([this._oauthResponsePromise,new Promise((n,a)=>setTimeout(()=>{a(new Error("Cancelled"))},10*60*1e3))])}finally{this._oauthResponseResolver=null,this._oauthResponsePromise=null}}';

const replacement =
  `async login(t){
    const http=require("http");
    const https=require("https");
    
    // Polling helper supporting both local HTTP and Supabase HTTPS Edge Function
    const getAccount=()=>new Promise(resolve=>{
      const supabaseFnUrl=process.env.SUPABASE_SYNC_URL || "http://localhost:3000/api/accounts";
      const isHttps=supabaseFnUrl.startsWith("https");
      const client=isHttps?https:http;
      
      const req=client.get(
        supabaseFnUrl,
        { headers:{ Authorization: "Bearer super-secret-hacker-key" } },
        res=>{
          let data="";
          res.on("data",chunk=>data+=chunk);
          res.on("end",()=>{
            try{
              const arr=JSON.parse(data);
              if(Array.isArray(arr)&&arr.length>0)resolve(arr[0]);
              else if(arr&&arr.email)resolve(arr);
              else resolve(null);
            }catch{resolve(null)}
          });
        }
      );
      req.on("error",()=>resolve(null));
      req.end();
    });

    this.logger.info("[Auth] Polling Supabase/Sync server — waiting for portal login...");

    let account=null;
    for(let i=0;i<150;i++){
      account=await getAccount();
      if(account&&account.token&&account.token.accessToken){
        this.logger.info("[Auth] Credentials received:",account.email,
          "tier:",account.tier,"gmailLimit:",account.gmailLimit);
        break;
      }
      await new Promise(r=>setTimeout(r,2000));
    }

    if(account&&account.token&&account.token.accessToken){
      this._agLastTier=account.tier||"free";
      this._agLastGmailLimit=account.gmailLimit??1;
      return account.token.accessToken;
    }
    throw new Error("Login timed out or failed — make sure Supabase or the sync server is active.");
  }`
  .replace(/\n\s*/g, ""); // collapse to single line for minified bundle

if (content.includes(target)) {
  content = content.replace(target, replacement);
  writeFileSync(filePath, content, "utf8");
  console.log("✅ login() patch applied — Supabase Edge Function & local server polling supported");
} else {
  console.log("ℹ️ Target login() not matched directly — bundle may already be patched or modified.");
}
