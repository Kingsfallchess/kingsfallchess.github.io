import { SignJWT, importPKCS8 } from "npm:jose@5.10.0";

const project = "kingsfall-61f66";
const tokenUrl = "https://oauth2.googleapis.com/token";
const json = (value: unknown, status = 200) => Response.json(value, { status });
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let cached: {value: string; expires: number} | undefined;
async function accessToken() {
  if (cached && Date.now() < cached.expires) return cached.value;
  const config = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "{}");
  if (config.project_id !== project || config.client_email !== "kingsfall-league-push@kingsfall-61f66.iam.gserviceaccount.com"
      || typeof config.private_key_id !== "string" || config.private_key_id.endsWith("76210fe36ae7")) throw Error("configuration");
  const key = await importPKCS8(config.private_key, "RS256");
  const jwt = await new SignJWT({scope:"https://www.googleapis.com/auth/firebase.messaging"})
    .setProtectedHeader({alg:"RS256",kid:config.private_key_id}).setIssuer(config.client_email)
    .setAudience(tokenUrl).setIssuedAt().setExpirationTime("5m").sign(key);
  const response = await fetch(tokenUrl, {method:"POST",body:new URLSearchParams({
    grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt
  })});
  if (!response.ok) throw Error("google_authentication");
  const token = await response.json();
  cached = {value:token.access_token,expires:Date.now() + Math.max(0,token.expires_in-90)*1000};
  return cached.value;
}
Deno.serve(async req => {
  if (req.method !== "POST") return json({error:"method"},405);
  if (!service || req.headers.get("Authorization") !== "Bearer "+service) return json({error:"unauthorized"},401);
  try {
    const input = await req.json();
    const isProbe = input.validate_only === true;
    if (!isProbe && (typeof input.token !== "string" || input.token.length < 32 || input.token.length > 4096
      || !["group_ready","schedule_ready"].includes(input.event))) return json({error:"invalid_request"},400);
    const fa = input.language === "fa";
    const ready = input.event === "group_ready";
    const message = { ...(isProbe ? {topic:"league-validation"} : {token:input.token}),
      notification:{title:fa?"لیگ کینگزفال":"Kingsfall League",body:ready
        ? (fa?"گروه ده‌نفره تکمیل شد. برای ثبت ساعت بازی وارد لیگ شو.":"Your group is full. Open the league to set your availability.")
        : (fa?"برنامهٔ بازی‌ها آماده است. بخش لیگ را ببین.":"Your schedule is ready. Open the league to see it.")}};
    const token = await accessToken();
    const reply = await fetch("https://fcm.googleapis.com/v1/projects/"+project+"/messages:send",{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
      body:JSON.stringify({validate_only:!!isProbe,message})
    });
    if (!reply.ok) {
      const details = await reply.json();
      return json({error:"fcm",status:reply.status,code:details.error?.status},502);
    }
    return json({ok:true,validation:!!isProbe});
  } catch (error) {
    return json({error:["configuration","google_authentication"].includes(error.message)?error.message:"configuration_or_network"},502);
  }
});
