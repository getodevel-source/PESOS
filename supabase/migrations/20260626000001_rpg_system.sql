-- Create user stats table
create table public.user_stats (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  level integer default 1 not null check (level >= 1),
  xp integer default 0 not null check (xp >= 0),
  streak integer default 0 not null check (streak >= 0),
  last_active_date date,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create achievements table
create table public.achievements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  icon text not null, -- emoji or lucide icon name
  xp_reward integer default 0 not null check (xp_reward >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user achievements table
create table public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_id uuid references public.achievements(id) on delete cascade not null,
  unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint user_achievement_unique unique (user_id, achievement_id)
);

-- Enable RLS
alter table public.user_stats enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- Create RLS Policies
create policy "Users can manage their own stats" on public.user_stats
  for all using (auth.uid() = user_id);

create policy "Anyone can read achievements" on public.achievements
  for select using (true);

create policy "Users can read/write their achievements" on public.user_achievements
  for all using (auth.uid() = user_id);

-- Insert seed achievements
insert into public.achievements (title, description, icon, xp_reward) values
  ('Primer Gasto', 'Registraste tu primer movimiento en la app', '💸', 50),
  ('Organizador Novato', 'Completaste tu primera tarea', '📋', 50),
  ('Constancia Inicial', 'Completaste todos tus hábitos por primera vez', '🔥', 100),
  ('Ahorrador', 'Cerraste un mes sin pasarte del límite del presupuesto', '🛡️', 200);

-- Update handle_new_user trigger to automatically initialize user_stats
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, full_name, telegram_username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'telegram_username'
  );
  
  insert into public.user_stats (user_id, level, xp, streak)
  values (new.id, 1, 0, 0);
  
  return new;
end;
$$;

-- Backfill user_stats for existing profiles
insert into public.user_stats (user_id, level, xp, streak)
select id, 1, 0, 0 from public.profiles
on conflict (user_id) do nothing;
