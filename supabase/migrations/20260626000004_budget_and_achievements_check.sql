-- Add monthly_budget to public.profiles if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'monthly_budget'
  ) then
    alter table public.profiles add column monthly_budget numeric(12, 2) default 0 check (monthly_budget >= 0);
  end if;
end;
$$;

-- Function to check and unlock achievements for a user
create or replace function public.check_and_unlock_achievements(target_user_id uuid)
returns table (
  achievement_title text,
  xp_awarded integer,
  newly_unlocked boolean
)
security definer
language plpgsql
as $$
declare
  profile_budget numeric(12, 2);
  has_reflection boolean := false;
  has_diet boolean := false;
  has_done_task boolean := false;
  has_perfect_habit_day boolean := false;
  has_7d_streak boolean := false;
  has_green_month boolean := false;

  -- Previous month dates
  prev_month_start date;
  prev_month_end date;
  prev_month_expenses numeric(12, 2);

  ach_id uuid;
  ach_reward integer;
  ach_title text;
  inserted_flag boolean;
begin
  -- 1. Get user's monthly budget
  select coalesce(monthly_budget, 0) into profile_budget
  from public.profiles
  where id = target_user_id;

  -- 2. Check criteria for achievements

  -- 'Primera Reflexión': >= 1 journal entry of type 'journal'
  select exists (
    select 1 from public.journal_entries
    where user_id = target_user_id and entry_type = 'journal'
  ) into has_reflection;

  -- 'Cuerpo Consciente': >= 1 journal entry of type 'diet'
  select exists (
    select 1 from public.journal_entries
    where user_id = target_user_id and entry_type = 'diet'
  ) into has_diet;

  -- 'Organizador Novato': >= 1 task completed
  select exists (
    select 1 from public.tasks
    where user_id = target_user_id and status = 'done'
  ) into has_done_task;

  -- 'Constancia Inicial': >= 1 day where total habit logs equals total active habits (min 1 habit)
  select exists (
    select 1
    from (
      select log_date, count(*) as completed_count
      from public.habit_logs
      where user_id = target_user_id
      group by log_date
    ) logs
    where logs.completed_count >= (
      select count(*) from public.habits where user_id = target_user_id
    ) and (
      select count(*) from public.habits where user_id = target_user_id
    ) > 0
  ) into has_perfect_habit_day;

  -- 'Racha de 7 días': Check if user_stats streak >= 7, or if they have 7 consecutive days in habit_logs
  select exists (
    select 1 from public.user_stats
    where user_id = target_user_id and streak >= 7
  ) or exists (
    -- fallback check in case streak isn't in user_stats yet
    select 1 from (
      -- find if there are 7 consecutive days with habit logs
      select log_date,
             log_date - (dense_rank() over (order by log_date))::integer as grp
      from public.habit_logs
      where user_id = target_user_id
      group by log_date
    ) t
    group by grp
    having count(*) >= 7
  ) into has_7d_streak;

  -- 'Mes en Verde': Check previous completed month's budget vs expenses
  prev_month_start := date_trunc('month', current_date - interval '1 month')::date;
  prev_month_end := (date_trunc('month', current_date) - interval '1 day')::date;

  select coalesce(sum(amount), 0) into prev_month_expenses
  from public.transactions
  where user_id = target_user_id
    and type = 'expense'
    and transaction_date >= prev_month_start
    and transaction_date <= prev_month_end;

  if profile_budget > 0 and prev_month_expenses <= profile_budget then
    -- Check that they actually had the budget set during that previous month (profile_budget > 0 is our best proxy)
    has_green_month := true;
  end if;

  -- 3. Loop through achievements and unlock if conditions are met
  for ach_id, ach_title, ach_reward in
    select id, title, xp_reward from public.achievements
  loop
    inserted_flag := false;
    newly_unlocked := false;
    xp_awarded := 0;
    achievement_title := ach_title;

    -- Map achievement title to condition
    if (ach_title = 'Primera Reflexión' and has_reflection) or
       (ach_title = 'Cuerpo Consciente' and has_diet) or
       (ach_title = 'Organizador Novato' and has_done_task) or
       (ach_title = 'Constancia Inicial' and has_perfect_habit_day) or
       (ach_title = 'Racha de 7 días' and has_7d_streak) or
       (ach_title = 'Mes en Verde' and has_green_month)
    then
      -- Attempt to insert achievement
      insert into public.user_achievements (user_id, achievement_id, unlocked_at)
      values (target_user_id, ach_id, now())
      on conflict (user_id, achievement_id) do nothing
      returning true into inserted_flag;

      -- If it was inserted (unlocked just now)
      if coalesce(inserted_flag, false) then
        newly_unlocked := true;
        xp_awarded := ach_reward;
        perform public.add_user_xp(target_user_id, ach_reward);
      end if;
    end if;

    -- Return row if we checked it
    if (ach_title = 'Primera Reflexión' and has_reflection) or
       (ach_title = 'Cuerpo Consciente' and has_diet) or
       (ach_title = 'Organizador Novato' and has_done_task) or
       (ach_title = 'Constancia Inicial' and has_perfect_habit_day) or
       (ach_title = 'Racha de 7 días' and has_7d_streak) or
       (ach_title = 'Mes en Verde' and has_green_month)
    then
      -- Check if they already had it unlocked previously (not newly unlocked but still unlocked)
      if not newly_unlocked then
        select exists (
          select 1 from public.user_achievements
          where user_id = target_user_id and achievement_id = ach_id
        ) into newly_unlocked;
        -- newly_unlocked is false because it was unlocked previously
        newly_unlocked := false;
      end if;
      
      return next;
    end if;
  end loop;
end;
$$;
