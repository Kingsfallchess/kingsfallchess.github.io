-- Apply retention.sql before this migration.
alter table kf_league.groups add column round_no int not null default 0,
 add column finished boolean not null default false, add column ticket uuid unique, add column retry_at timestamptz;
alter table kf_league.members add column mode text not null default 'classic', add column style jsonb not null default '{}',
 add column lot uuid not null default gen_random_uuid();
create table kf_league.fixtures(
 id uuid primary key default gen_random_uuid(), gid uuid not null references kf_league.groups on delete cascade,
 day int not null check(day between 1 and 18), host uuid not null, guest uuid not null check(host<>guest),
 starts timestamptz not null, mode text not null, style jsonb not null,
 state text not null default 'scheduled', winner uuid, unique(gid,host,guest)
);
create index fixtures_start on kf_league.fixtures(starts) where state='scheduled';
create table kf_league.final_table(gid uuid not null references kf_league.groups on delete cascade, player uuid not null, name text, points numeric, place int, next_level int, primary key(gid,player));
create function kf_league.ranks(group_key uuid) returns table(player uuid,name text,points numeric,place bigint)
language sql stable set search_path='' as $$
 with scores as (
 select m.user_id, coalesce(u.raw_user_meta_data->>'username','Player') name,m.lot,
 coalesce(s.wins,0)+coalesce(s.bt_wins,0)+20*coalesce(s.tournament_wins,0) overall,
 coalesce(sum(case when f.winner=m.user_id then 1 when f.state='draw' then 0.5 else 0 end),0) pts
 from kf_league.members m join auth.users u on u.id=m.user_id left join public.kf_player_stats s on s.user_id=m.user_id
 left join kf_league.fixtures f on f.gid=m.group_id and m.user_id in(f.host,f.guest)
 where m.group_id=group_key group by m.user_id,u.raw_user_meta_data,s.wins,s.bt_wins,s.tournament_wins,m.lot)
 select a.user_id,a.name,a.pts,row_number() over(order by a.pts desc,
 (select coalesce(sum(case when f.winner=a.user_id then 1 when f.state='draw' then 0.5 else 0 end),0)
 from kf_league.fixtures f join scores b on b.user_id in(f.host,f.guest) and b.user_id<>a.user_id and b.pts=a.pts
 where f.gid=group_key and a.user_id in(f.host,f.guest)) desc,a.overall desc,a.lot)
 from scores a
$$;
-- League results replace the regular stats callback only for known league game IDs.
create function kf_league.is_fixture(game_key uuid) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from kf_league.fixtures where id=game_key) $$;
create or replace trigger kf_game_completion_stats after update of status on public.kf_games for each row
 when(old.status is distinct from new.status and new.status='completed' and not kf_league.is_fixture(new.id))
 execute function public.kf_handle_game_completion();
create function kf_league.record_result() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update kf_league.fixtures set state=case when new.status='cancelled' then 'cancelled' when new.winner_id is null then 'draw' else 'won' end,
 winner=case when new.status='completed' then new.winner_id end where id=new.id and state='playing';
 return new;
end $$;
create trigger league_result after update of status on public.kf_games for each row
 when(old.status is distinct from new.status and new.status in ('completed','cancelled') and kf_league.is_fixture(new.id))
 execute function kf_league.record_result();

create function public.kf_league_round_exchange(key uuid, matches jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare g kf_league.groups; cutoff timestamptz; x jsonb; a uuid; b uuid; t timestamptz; used uuid[]:='{}'; m kf_league.members;
begin
 select * into g from kf_league.groups where ticket=key and not finished and round_no<18 for update;
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
end $$;
revoke all on function public.kf_league_round_exchange(uuid,jsonb) from public;
grant execute on function public.kf_league_round_exchange(uuid,jsonb) to anon;

create function kf_league.tick() returns void language plpgsql security definer set search_path='' as $$
declare g kf_league.groups; f kf_league.fixtures; k uuid;
begin
 for g in select * from kf_league.groups where not finished and deadline+round_no*interval '24 hours'<=now()
 and (retry_at is null or retry_at<=now()) for update skip locked loop
 if g.round_no<18 then
 k:=gen_random_uuid();
 update kf_league.groups set ticket=k,retry_at=now()+interval '2 minutes' where id=g.id;
 perform net.http_post(url:='https://pjurtwipcrwzyofrbqkb.supabase.co/functions/v1/kf-league-schedule',body:=jsonb_build_object('key',k),timeout_milliseconds:=20000);
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
end $$;
revoke all on function kf_league.tick() from public,anon,authenticated;
select cron.schedule('kf-league-rounds','* * * * *','select kf_league.tick()');
create function public.kf_league_board() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me kf_league.members; g kf_league.groups; cutoff timestamptz;
begin
 select * into me from kf_league.members where user_id=auth.uid(); if not found then return null; end if;
 select * into strict g from kf_league.groups where id=me.group_id;
 cutoff:=g.deadline+g.round_no*interval '24 hours';
 return jsonb_build_object('group_id',g.id,'round',g.round_no,'finished',g.finished,'deadline',cutoff,'mode',me.mode,'style',me.style,'windows',me.windows,
 'can_edit',not g.finished and g.round_no<18 and cutoff>now() and not exists(select from kf_league.fixtures where gid=g.id and day=g.round_no and me.user_id in(host,guest) and state in('scheduled','playing')),
 'standings',case when g.finished then (select jsonb_agg(to_jsonb(t) order by place) from kf_league.final_table t where gid=g.id)
 else (select jsonb_agg(to_jsonb(r) order by place) from kf_league.ranks(g.id) r) end,
 'matches',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('home_name',h.raw_user_meta_data->>'username','away_name',a.raw_user_meta_data->>'username') order by f.day,f.starts)
 from kf_league.fixtures f left join auth.users h on h.id=f.host left join auth.users a on a.id=f.guest where f.gid=g.id),'[]'::jsonb));
end $$;
create function public.kf_league_choices(cutoff timestamptz,windows jsonb,mode text,style jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare g kf_league.groups; w jsonb; a timestamptz; b timestamptz;
begin
 select groups.* into g from kf_league.groups groups join kf_league.members m on m.group_id=groups.id where m.user_id=auth.uid() for update of groups;
 if not found or g.finished or g.round_no>=18 or cutoff is distinct from g.deadline+g.round_no*interval '24 hours' or clock_timestamp()>=cutoff
 or exists(select 1 from kf_league.fixtures where gid=g.id and day=g.round_no and auth.uid() in(host,guest) and state in('scheduled','playing')) then raise exception 'Availability closed'; end if;
 if jsonb_typeof(windows) is distinct from 'array' or jsonb_array_length(windows)>96 or mode not in ('classic','roulette','bloodblade') or mode is null
 or jsonb_typeof(style) is distinct from 'object' or length(style::text)>200 then raise exception 'Invalid choices'; end if;
 for w in select value from jsonb_array_elements(windows) loop
 a:=(w->>'start')::timestamptz;b:=(w->>'end')::timestamptz;
 if a is null or b is null or a<cutoff or b>cutoff+interval '24 hours' or b-a<interval '15 minutes' then raise exception 'Invalid windows'; end if;
 end loop;
 update kf_league.members set windows=kf_league_choices.windows,mode=kf_league_choices.mode,style=kf_league_choices.style where user_id=auth.uid();
end $$;
create or replace function public.kf_league_save_windows(windows jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b jsonb:=public.kf_league_board();
begin perform public.kf_league_choices((b->>'deadline')::timestamptz,windows,b->>'mode',b->'style'); end $$;

create function public.kf_league_next_game() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',f.id,'starts',f.starts,'state',f.state,'mode',f.mode,'style',f.style)
 from kf_league.members m join kf_league.fixtures f on f.gid=m.group_id and m.user_id in(f.host,f.guest)
 where m.user_id=auth.uid() and f.state in('scheduled','playing') order by f.starts limit 1
$$;
revoke all on function public.kf_league_choices(timestamptz,jsonb,text,jsonb),public.kf_league_next_game(),public.kf_league_board() from public,anon;
grant execute on function public.kf_league_choices(timestamptz,jsonb,text,jsonb),public.kf_league_next_game(),public.kf_league_board() to authenticated;
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
    if action='join' then
      delete from kf_league.members m using kf_league.groups g where m.user_id=player and g.id=m.group_id and g.finished;
    end if;
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

