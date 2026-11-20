-- Kingsfall league worker authentication hardening.
-- No plaintext credentials are committed. Each installation generates private random keys.
-- Applied to the primary Kingsfall Supabase project 2026-11-21.
-- The second project's edge functions require x-kf-worker-proof.
-- Do NOT rotate keys while jobs are in flight without coordinating retries.

create table if not exists kf_league.worker_signing_keys (
  purpose text primary key check (purpose in ('push','schedule')),
  secret text not null check (length(secret)=64),
  rotated_at timestamptz not null default now()
);
alter table kf_league.worker_signing_keys enable row level security;
revoke all on table kf_league.worker_signing_keys from public,anon,authenticated;
insert into kf_league.worker_signing_keys(purpose,secret)
values ('push',encode(extensions.gen_random_bytes(32),'hex')),
       ('schedule',encode(extensions.gen_random_bytes(32),'hex'))
on conflict(purpose) do nothing;

CREATE OR REPLACE FUNCTION kf_league.dispatch_ready()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m record;
begin
  for m in
    select p.user_id from kf_league.members p join kf_league.groups g on g.id=p.group_id
    where not p.delivered and p.retry_at<=now() and g.deadline>now()
      and exists(select 1 from kf_league.devices d where d.user_id=p.user_id)
    order by p.retry_at limit 50 for update of p skip locked
  loop
    declare ticket uuid := gen_random_uuid();
    begin
      update kf_league.members set attempt=ticket, claimed=false, retry_at=now()+interval '5 minutes' where user_id=m.user_id;
      perform net.http_post(url:='https://pjurtwipcrwzyofrbqkb.supabase.co/functions/v1/kf-league-group-ready',
        body:=jsonb_build_object('ticket',ticket),headers:=jsonb_build_object('Content-Type','application/json','x-kf-worker-proof',kf_league.worker_signature('push',ticket)),timeout_milliseconds:=20000);
    end;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION kf_league.require_worker(job_purpose text, ticket uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 expected text;
 provided text;
 headers jsonb;
begin
 expected := kf_league.worker_signature(job_purpose,ticket);
 begin
   headers := nullif(current_setting('request.headers',true),'')::jsonb;
 exception when others then
   headers := null;
 end;
 provided := headers->>'x-kf-worker-proof';
 if expected is null or provided is null
    or provided !~ '^[a-f0-9]{64}$' or provided <> expected then
   raise exception 'League worker authentication required' using errcode='42501';
 end if;
end $function$;

CREATE OR REPLACE FUNCTION kf_league.tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g kf_league.groups; f kf_league.fixtures; k uuid;
begin
 for g in select * from kf_league.groups where not finished and deadline+round_no*interval '24 hours'<=now()
 and (retry_at is null or retry_at<=now()) for update skip locked loop
 if g.round_no<18 then
 k:=gen_random_uuid();
 update kf_league.groups set ticket=k,retry_at=now()+interval '2 minutes' where id=g.id;
 perform net.http_post(url:='https://pjurtwipcrwzyofrbqkb.supabase.co/functions/v1/kf-league-schedule',body:=jsonb_build_object('key',k),headers:=jsonb_build_object('Content-Type','application/json','x-kf-worker-proof',kf_league.worker_signature('schedule',k)),timeout_milliseconds:=20000);
 elsif not exists(select 1 from kf_league.fixtures where gid=g.id and state in('scheduled','playing')) then
 insert into kf_league.final_table select g.id,r.player,r.name,r.points,r.place,greatest(1,g.level+case when r.place<=5 then 1 else -1 end) from kf_league.ranks(g.id) r;
 insert into kf_league.levels(user_id,level) select player,next_level from kf_league.final_table where gid=g.id
 on conflict(user_id) do update set level=excluded.level;
 update kf_league.groups set finished=true,finished_at=clock_timestamp() where id=g.id;
 end if;
 end loop;
 for f in select * from kf_league.fixtures where state='scheduled' and starts<=now() order by starts for update skip locked loop
 if f.starts < now()-interval '2 minutes' then update kf_league.fixtures set state='cancelled' where id=f.id; continue; end if;
 insert into public.kf_games(id,white_id,black_id,white_username,black_username,white_avatar,black_avatar,white_wins,black_wins,status,is_roulette,is_bloodblade)
 select f.id,a.id,b.id,coalesce(a.raw_user_meta_data->>'username','Player'),coalesce(b.raw_user_meta_data->>'username','Player'),
 a.raw_user_meta_data->>'avatar_url',b.raw_user_meta_data->>'avatar_url',coalesce(sa.wins,0),coalesce(sb.wins,0),'active',f.mode='roulette',f.mode='bloodblade'
 from auth.users a join auth.users b on b.id=f.guest left join public.kf_player_stats sa on sa.user_id=a.id left join public.kf_player_stats sb on sb.user_id=b.id where a.id=f.host;
 update kf_league.fixtures set state=case when exists(select 1 from public.kf_games where id=f.id) then 'playing' else 'cancelled' end where id=f.id;
 end loop;
 update public.kf_games game set status='cancelled',completed_at=now(),updated_at=now() from kf_league.fixtures stale
 where game.id=stale.id and stale.mode='roulette' and stale.state='playing' and game.status='active' and game.roulette_opening_applied_at is null and game.created_at<now()-interval '1 minute';
end $function$;

CREATE OR REPLACE FUNCTION kf_league.worker_signature(job_purpose text, ticket uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select encode(extensions.hmac(job_purpose||':'||ticket::text,secret,'sha256'),'hex')
 from kf_league.worker_signing_keys where purpose=job_purpose
$function$;

CREATE OR REPLACE FUNCTION public.kf_league_push_ticket(ticket uuid, action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare member kf_league.members; payload jsonb;
begin
  perform kf_league.require_worker('push',ticket);
  select * into member from kf_league.members m where m.attempt=ticket and not m.delivered and m.retry_at>clock_timestamp() for update;
  if not found then return null; end if;
  if action='claim' and not member.claimed then
    select jsonb_build_object('token',d.token,'group_id',g.id,'deadline',g.deadline,'language',
      case when upper(u.raw_user_meta_data->>'registration_country')='IR' then 'fa' else 'en' end)
    into payload from kf_league.devices d join auth.users u on u.id=d.user_id
    join kf_league.groups g on g.id=member.group_id and g.deadline>now()
    where d.user_id=member.user_id order by d.updated_at desc,d.token limit 1;
    if payload is not null then update kf_league.members set claimed=true where user_id=member.user_id; end if;
    return payload;
  elsif action='delivered' and member.claimed then
    update kf_league.members set delivered=true, attempt=null where user_id=member.user_id;
    return 'true'::jsonb;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.kf_league_round_exchange(key uuid, matches jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g kf_league.groups; cutoff timestamptz; x jsonb; a uuid; b uuid; t timestamptz; used uuid[]:='{}'; m kf_league.members;
begin
 perform kf_league.require_worker('schedule',key);
 select * into g from kf_league.groups where ticket=key and not finished and round_no<18 and retry_at>clock_timestamp() for update;
 if not found then return null; end if;
 cutoff:=g.deadline+g.round_no*interval '24 hours';
 if matches is null then
 return jsonb_build_object('announced',extract(epoch from clock_timestamp()+interval '5 seconds')*1000,'end',extract(epoch from cutoff+interval '24 hours')*1000,
 'players',(select jsonb_agg(jsonb_build_object('id',user_id,'windows',windows) order by lot) from kf_league.members where group_id=g.id),
 'history',coalesce((select jsonb_agg(jsonb_build_object('host',host,'guest',guest)) from kf_league.fixtures where gid=g.id),'[]'::jsonb));
 end if;
 if jsonb_typeof(matches)<>'array' or jsonb_array_length(matches)>5 then raise exception 'Invalid pairing'; end if;
 for x in select value from jsonb_array_elements(matches) loop
 a:=(x->>'host')::uuid; b:=(x->>'guest')::uuid; t:=to_timestamp((x->>'start')::double precision/1000);
 if a=b or a=any(used) or b=any(used) or t<clock_timestamp()+interval '15 minutes' or mod(extract(epoch from t),900)<>0 or t+interval '15 minutes'>cutoff+interval '24 hours'
 or 2<>(select count(*) from kf_league.members m1 where m1.group_id=g.id and m1.user_id in(a,b) and exists(select 1 from jsonb_array_elements(m1.windows) w where (w->>'start')::timestamptz<=t and (w->>'end')::timestamptz>=t+interval '15 minutes'))
 then raise exception 'Invalid pairing'; end if;
 used:=used||array[a,b]; select * into strict m from kf_league.members where user_id=a;
 insert into kf_league.fixtures(gid,day,host,guest,starts,mode,style) values(g.id,g.round_no+1,a,b,t,m.mode,m.style);
 end loop;
 update kf_league.groups set round_no=round_no+1,ticket=null,retry_at=null where id=g.id;
 update kf_league.members set windows='[]' where group_id=g.id;
 return 'true'::jsonb;
end $function$;

revoke all on function kf_league.worker_signature(text,uuid) from public,anon,authenticated;
revoke all on function kf_league.require_worker(text,uuid) from public,anon,authenticated;
