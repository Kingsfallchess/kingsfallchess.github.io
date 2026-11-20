create table kf_league.groups (
  id uuid primary key default gen_random_uuid(), level integer not null,
  deadline timestamptz not null default (now()+interval '24 hours')
);
create table kf_league.members (
  user_id uuid primary key references auth.users on delete cascade,
  group_id uuid not null references kf_league.groups,
  windows jsonb not null default '[]',
  delivered boolean not null default false,
  attempt uuid unique, retry_at timestamptz not null default now(),
  claimed boolean not null default false
);
create index league_pending_push on kf_league.members(retry_at) where not delivered;
create function kf_league.dispatch_ready() returns void language plpgsql set search_path='' as $$
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
        body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=20000);
    end;
  end loop;
end $$;
create function public.kf_league_push_ticket(ticket uuid, action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member kf_league.members; payload jsonb;
begin
  select * into member from kf_league.members m where m.attempt=ticket and not m.delivered for update;
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
end $$;
revoke all on function public.kf_league_push_ticket(uuid,text) from public;
grant execute on function public.kf_league_push_ticket(uuid,text) to anon;

create or replace function public.kf_league_registration(action text default 'status')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  player uuid:=auth.uid(); current_level integer; enrolled uuid[]; group_key uuid;
  own jsonb; pos integer;
begin
  if not exists(select 1 from auth.users where id=player and not coalesce(is_anonymous,false)
    and nullif(trim(email),'') is not null and (banned_until is null or banned_until<=now())) then
    raise exception using errcode='42501',message='Email account required';
  end if;
  select coalesce((select level from kf_league.levels where user_id=player),1) into current_level;
  if action in ('join','leave') then
    perform pg_advisory_xact_lock(18112026,current_level);
    if action='leave' then delete from kf_league.queue where user_id=player;
    elsif not exists(select 1 from kf_league.members where user_id=player) then
      insert into kf_league.queue(user_id,level) values(player,current_level) on conflict do nothing;
      select array(select user_id from kf_league.queue where level=current_level order by joined_at,user_id limit 10) into enrolled;
      if cardinality(enrolled)=10 then
        insert into kf_league.groups(level) values(current_level) returning id into group_key;
        insert into kf_league.members(user_id,group_id) select unnest(enrolled),group_key;
        delete from kf_league.queue where user_id=any(enrolled);
        perform kf_league.dispatch_ready();
      end if;
    end if;
  elsif action is distinct from 'status' then raise exception 'Unknown league action'; end if;
  select jsonb_build_object('group_id',g.id,'deadline',g.deadline,'windows',m.windows,'joined',true,'level',g.level)
    into own from kf_league.members m join kf_league.groups g on g.id=m.group_id where m.user_id=player;
  if own is not null then return own; end if;
  select s.n into pos from (select user_id,row_number() over(order by joined_at,user_id) n from kf_league.queue where level=current_level) s where s.user_id=player;
  return jsonb_build_object('joined',pos is not null,'level',current_level,'position',pos);
end $$;

create function public.kf_league_save_windows(windows jsonb) returns void language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz; w jsonb; a timestamptz; b timestamptz;
begin
  select g.deadline into cutoff from kf_league.members m join kf_league.groups g on g.id=m.group_id
    where m.user_id=auth.uid() for update of m;
  if cutoff is null or clock_timestamp()>=cutoff then raise exception 'Availability closed'; end if;
  if jsonb_typeof(windows) is distinct from 'array' or jsonb_array_length(windows)>96 then raise exception 'Invalid windows'; end if;
  for w in select value from jsonb_array_elements(windows) loop
    a:=(w->>'start')::timestamptz; b:=(w->>'end')::timestamptz;
    if a is null or b is null or a<cutoff or b>cutoff+interval '24 hours' or b-a<interval '15 minutes' then raise exception 'Invalid time window'; end if;
  end loop;
  update kf_league.members set windows=kf_league_save_windows.windows where user_id=auth.uid();
end $$;
revoke all on function public.kf_league_save_windows(jsonb) from public,anon;
grant execute on function public.kf_league_save_windows(jsonb) to authenticated;
select cron.schedule('kf-league-group-ready','* * * * *','select kf_league.dispatch_ready()');
