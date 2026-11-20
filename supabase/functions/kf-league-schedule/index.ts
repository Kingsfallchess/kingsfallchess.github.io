import {scheduleRound} from './schedule.mjs';
const endpoint='https://cyqactlxetfjyjvklpox.supabase.co/rest/v1/rpc/kf_league_round_exchange';
const headers={'Content-Type':'application/json',apikey:'sb_publishable_5kPdWhNs53AY_PB29pRGBw_pvXiB0_k'};
async function exchange(key:string,matches:unknown,proof:string) {
  const response=await fetch(endpoint,{method:'POST',headers:{...headers,'x-kf-worker-proof':proof},body:JSON.stringify({key,matches})});
  if(!response.ok) throw Error('round exchange failed');
  return response.json();
}
Deno.serve(async req=>{
  if(req.method!=='POST') return new Response(null,{status:405});
  try {
    const {key}=await req.json();
    const proof=req.headers.get('x-kf-worker-proof')||'';
    if(!/^[a-f0-9]{64}$/.test(proof)) return new Response(null,{status:401});
    if(typeof key!=='string'||!/^[0-9a-f-]{36}$/.test(key)) return new Response(null,{status:400});
    const job=await exchange(key,null,proof);
    if(!job) return new Response(null,{status:403});
    const players=job.players.map(p=>({...p,windows:p.windows.map(w=>[Date.parse(w.start),Date.parse(w.end)])}));
    const matches=scheduleRound(players,job.history,job.announced,job.end);
    await exchange(key,matches,proof);
    return new Response(null,{status:204});
  } catch {return new Response(null,{status:503});}
});
