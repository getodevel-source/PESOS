-- Function to update XP and level up in user_stats
create or replace function public.add_user_xp(target_user_id uuid, xp_to_add integer)
returns void
security definer
language plpgsql
as $$
declare
  current_xp integer;
  current_level integer;
  new_xp integer;
  new_level integer;
begin
  -- Get current stats
  select xp, level into current_xp, current_level
  from public.user_stats
  where user_id = target_user_id;
  
  if not found then
    insert into public.user_stats (user_id, level, xp, streak)
    values (target_user_id, 1, 0, 0);
    current_xp := 0;
    current_level := 1;
  end if;
  
  -- Calculate new stats
  new_xp := current_xp + xp_to_add;
  if new_xp < 0 then
    new_xp := 0;
  end if;
  
  -- Level formula: Level = floor(new_xp / 100) + 1
  new_level := floor(new_xp / 100) + 1;
  if new_level < 1 then
    new_level := 1;
  end if;
  
  -- Update stats
  update public.user_stats
  set xp = new_xp,
      level = new_level,
      updated_at = now()
  where user_id = target_user_id;
end;
$$;

-- Trigger function for task updates (XP on status change)
create or replace function public.on_task_status_change()
returns trigger
security definer
language plpgsql
as $$
begin
  if (old.status = 'todo' or old.status = 'ignored') and new.status = 'done' then
    perform public.add_user_xp(new.user_id, 10);
  elsif old.status = 'done' and (new.status = 'todo' or new.status = 'ignored') then
    perform public.add_user_xp(new.user_id, -10);
  end if;
  return new;
end;
$$;

-- Trigger function for habit log updates (XP on habit logs)
create or replace function public.on_habit_log_change()
returns trigger
security definer
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.add_user_xp(new.user_id, 15);
  elsif tg_op = 'DELETE' then
    perform public.add_user_xp(old.user_id, -15);
  end if;
  return null;
end;
$$;

-- Apply triggers to tasks and habit_logs
drop trigger if exists trigger_task_xp on public.tasks;
create trigger trigger_task_xp
  after update on public.tasks
  for each row
  execute procedure public.on_task_status_change();

drop trigger if exists trigger_habit_log_xp on public.habit_logs;
create trigger trigger_habit_log_xp
  after insert or delete on public.habit_logs
  for each row
  execute procedure public.on_habit_log_change();

-- Recalculate stats for existing data
do $$
declare
  r record;
  done_tasks_count integer;
  habit_logs_count integer;
  total_xp integer;
  calc_level integer;
begin
  for r in select id from public.profiles loop
    select count(*) into done_tasks_count from public.tasks where user_id = r.id and status = 'done';
    select count(*) into habit_logs_count from public.habit_logs where user_id = r.id;
    
    total_xp := (done_tasks_count * 10) + (habit_logs_count * 15);
    calc_level := floor(total_xp / 100) + 1;
    
    insert into public.user_stats (user_id, level, xp, streak)
    values (r.id, calc_level, total_xp, 0)
    on conflict (user_id) do update
    set xp = total_xp,
        level = calc_level;
  end loop;
end;
$$;
