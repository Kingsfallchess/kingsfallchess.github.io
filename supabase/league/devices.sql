create table kf_league.devices (
  token text primary key,
  user_id uuid not null references auth.users on delete cascade,
  updated_at timestamptz not null default now()
);
create index league_devices_user on kf_league.devices(user_id);
create function public.kf_register_league_device(device_token text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (select 1 from auth.users where id=auth.uid()
      and not coalesce(is_anonymous,false) and nullif(email,'') is not null
      and (banned_until is null or banned_until <= now())) then
    raise exception using errcode='42501', message='Email account required';
  end if;
  if device_token is null or length(device_token) not between 32 and 4096 or device_token ~ '[[:space:]]' then
    raise exception 'Invalid device token';
  end if;
  insert into kf_league.devices(token,user_id) values(device_token,auth.uid())
  on conflict(token) do update set user_id=excluded.user_id, updated_at=now();
end $$;
revoke all on function public.kf_register_league_device(text) from public,anon;
grant execute on function public.kf_register_league_device(text) to authenticated;
