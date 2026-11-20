-- Apply after group_ready.sql. The season finalizer sets finished_at after saving levels.
alter table kf_league.groups add column if not exists finished_at timestamptz;
create index if not exists league_groups_finished_at on kf_league.groups(finished_at) where finished_at is not null;
create or replace function kf_league.purge_finished_groups()
returns integer language plpgsql set search_path='' as $$
declare expired uuid; removed integer:=0;
begin
  for expired in select id from kf_league.groups
      where finished_at <= statement_timestamp()-interval '24 hours'
      order by finished_at for update skip locked
  loop
    delete from kf_league.members where group_id=expired;
    -- Fixtures and final standings belong to this group and cascade on deletion.
    delete from kf_league.groups where id=expired;
    removed:=removed+1;
  end loop;
  return removed;
end $$;
revoke all on function kf_league.purge_finished_groups() from public,anon,authenticated;
select cron.schedule('kf-league-retention','0 * * * *','select kf_league.purge_finished_groups()');
