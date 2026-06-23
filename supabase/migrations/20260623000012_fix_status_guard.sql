-- Allow status changes only when a SECURITY DEFINER RPC has explicitly opted in.
-- RPCs that legitimately change status must `set local "app.allow_status_change" = 'on';`
-- at the top of their body. Direct client UPDATEs do not set this and are still blocked.
create or replace function public.guard_ts_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
      raise exception 'status may only be changed via RPC' using errcode = '42501';
    end if;
  end if;
  return new;
end$$;
