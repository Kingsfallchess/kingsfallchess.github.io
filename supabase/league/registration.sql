create schema if not exists kf_league;
revoke all on schema kf_league from public, anon, authenticated;

create table kf_league.levels (
  user_id uuid primary key references auth.users on delete cascade,
  level integer not null default 1 check (level >= 1)
);
create table kf_league.queue (
  user_id uuid primary key references auth.users on delete cascade,
  level integer not null check (level >= 1),
  joined_at timestamptz not null default now()
);
create index league_queue_by_level on kf_league.queue(level, joined_at, user_id);
create function public.kf_league_registration(action text default 'status')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player uuid := auth.uid();
  current_level integer;
  position integer;
  joined_at_value timestamptz;
begin
  if not exists (select 1 from auth.users u where u.id = player and not coalesce(u.is_anonymous,false)
    and nullif(trim(u.email),'') is not null and (u.banned_until is null or u.banned_until <= now())) then
    raise exception using errcode='42501', message='Email account required';
  end if;
  select coalesce((select l.level from kf_league.levels l where l.user_id=player),1) into current_level;
  if action='join' then
    insert into kf_league.queue(user_id,level) values(player,current_level) on conflict(user_id) do nothing;
  elsif action='leave' then
    delete from kf_league.queue q where q.user_id=player;
  elsif action is distinct from 'status' then
    raise exception 'Unknown league action';
  end if;
  select q.joined_at into joined_at_value from kf_league.queue q where q.user_id=player;
  if joined_at_value is not null then
    select count(*) into position from kf_league.queue q where q.level=current_level and (q.joined_at,q.user_id)<=(joined_at_value,player);
  end if;
  return jsonb_build_object('joined',joined_at_value is not null,'level',current_level,'position',position);
end $$;
revoke all on function public.kf_league_registration(text) from public, anon;
grant execute on function public.kf_league_registration(text) to authenticated;
