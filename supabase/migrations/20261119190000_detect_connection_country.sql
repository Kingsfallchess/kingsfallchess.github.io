create or replace function public.kf_connection_country() returns text language sql stable security invoker set search_path = '' as $$
  select case when code ~ '^[A-Z]{2}$' and code <> 'XX' then code end
  from (select current_setting('request.headers', true)::jsonb ->> 'cf-ipcountry' as code) h
$$;
revoke all on function public.kf_connection_country() from public;
grant execute on function public.kf_connection_country() to anon, authenticated;