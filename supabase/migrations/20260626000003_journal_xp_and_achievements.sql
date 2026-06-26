-- ─── XP triggers for journal_entries (reflections & diet logs) ───────────────

-- Trigger function: award XP when a journal entry is inserted
create or replace function public.on_journal_entry_insert()
returns trigger
security definer
language plpgsql
as $$
begin
  if new.entry_type = 'journal' then
    -- Reflection: 20 XP
    perform public.add_user_xp(new.user_id, 20);
  elsif new.entry_type = 'diet' then
    -- Diet log: 15 XP
    perform public.add_user_xp(new.user_id, 15);
  end if;
  return new;
end;
$$;

-- Remove XP when a journal entry is deleted
create or replace function public.on_journal_entry_delete()
returns trigger
security definer
language plpgsql
as $$
begin
  if old.entry_type = 'journal' then
    perform public.add_user_xp(old.user_id, -20);
  elsif old.entry_type = 'diet' then
    perform public.add_user_xp(old.user_id, -15);
  end if;
  return old;
end;
$$;

drop trigger if exists trigger_journal_xp_insert on public.journal_entries;
create trigger trigger_journal_xp_insert
  after insert on public.journal_entries
  for each row
  execute procedure public.on_journal_entry_insert();

drop trigger if exists trigger_journal_xp_delete on public.journal_entries;
create trigger trigger_journal_xp_delete
  after delete on public.journal_entries
  for each row
  execute procedure public.on_journal_entry_delete();

-- ─── Update achievements seed to reflect actual XP sources ───────────────────

-- Remove the "Primer Gasto" achievement (transactions no longer give XP)
delete from public.achievements where title = 'Primer Gasto';

-- Add new achievements aligned with habits, reflections, diet, and budget
insert into public.achievements (title, description, icon, xp_reward) values
  ('Primera Reflexión',   'Escribiste tu primera reflexión en el diario',           '📝', 50),
  ('Cuerpo Consciente',   'Registraste tu primera entrada de dieta',                '🥗', 50),
  ('Racha de 7 días',     'Completaste al menos un hábito cada día por 7 días',     '🔥', 150),
  ('Mes en Verde',        'Cerraste un mes sin pasarte de tu presupuesto',          '🛡️', 300)
on conflict do nothing;

-- Update the existing "Ahorrador" description to match budget goal
update public.achievements
set title = 'Mes en Verde', description = 'Cerraste un mes sin pasarte de tu presupuesto', xp_reward = 300
where title = 'Ahorrador';

-- ─── Recalculate XP for existing journal entries ──────────────────────────────

do $$
declare
  r record;
  journal_count integer;
  diet_count integer;
  task_done_count integer;
  habit_log_count integer;
  total_xp integer;
  calc_level integer;
begin
  for r in select id from public.profiles loop
    select count(*) into task_done_count   from public.tasks         where user_id = r.id and status = 'done';
    select count(*) into habit_log_count   from public.habit_logs    where user_id = r.id;
    select count(*) into journal_count     from public.journal_entries where user_id = r.id and entry_type = 'journal';
    select count(*) into diet_count        from public.journal_entries where user_id = r.id and entry_type = 'diet';

    total_xp   := (task_done_count * 10) + (habit_log_count * 15) + (journal_count * 20) + (diet_count * 15);
    calc_level := floor(total_xp / 100) + 1;

    insert into public.user_stats (user_id, level, xp, streak)
    values (r.id, calc_level, total_xp, 0)
    on conflict (user_id) do update
    set xp = total_xp, level = calc_level;
  end loop;
end;
$$;
