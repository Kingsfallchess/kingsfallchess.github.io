// A short-lived, single-use ticket binds one request to one group member.
const rpcUrl = 'https://cyqactlxetfjyjvklpox.supabase.co/rest/v1/rpc/kf_league_push_ticket';
const publicKey = 'sb_publishable_5kPdWhNs53AY_PB29pRGBw_pvXiB0_k';
async function exchange(ticket: string, action: string, proof: string) {
  const result = await fetch(rpcUrl,{method:'POST', headers:{apikey:publicKey,'Content-Type':'application/json','x-kf-worker-proof':proof},
    body:JSON.stringify({ticket,action})});
  if (!result.ok) throw Error('exchange');
  return result.json();
}
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response(null,{status:405});
  try {
    const {ticket} = await req.json();
    const proof=req.headers.get('x-kf-worker-proof')||'';
    if(!/^[a-f0-9]{64}$/.test(proof)) return new Response(null,{status:401});
    if (typeof ticket !== 'string' || !/^[a-f0-9-]{36}$/.test(ticket)) return new Response(null,{status:400});
    const job = await exchange(ticket,'claim',proof);
    if (!job) return new Response(null,{status:403});
    const result = await fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/kf-league-push',{
      method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},
      body:JSON.stringify({...job,event:'group_ready'})});
    if (!result.ok) return new Response(null,{status:502});
    await exchange(ticket,'delivered',proof);
    return new Response(null,{status:204});
  } catch {return new Response(null,{status:503});}
});
