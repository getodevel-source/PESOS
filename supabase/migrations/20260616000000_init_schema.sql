-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  telegram_chat_id bigint unique,
  telegram_username text,
  timezone text default 'UTC' not null
);

-- Create inputs table
create table public.inputs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  payload jsonb not null,
  processed boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create tasks table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  status text check (status in ('todo', 'done', 'ignored')) default 'todo' not null,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create habits table
create table public.habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  frequency text default 'daily' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create habit logs table
create table public.habit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  habit_id uuid references public.habits(id) on delete cascade not null,
  log_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint habit_logs_habit_date_unique unique (habit_id, log_date)
);

-- Create transactions table
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  type text check (type in ('income', 'expense')) not null,
  transaction_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create journal entries table
create table public.journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  entry_type text check (entry_type in ('journal', 'diet')) default 'journal' not null,
  entry_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row-Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.inputs enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.transactions enable row level security;
alter table public.journal_entries enable row level security;

-- Create RLS Policies
create policy "Users can manage their own profile" on public.profiles
  for all using (auth.uid() = id);

create policy "Users can manage their own inputs" on public.inputs
  for all using (auth.uid() = user_id);

create policy "Users can manage their own tasks" on public.tasks
  for all using (auth.uid() = user_id);

create policy "Users can manage their own habits" on public.habits
  for all using (auth.uid() = user_id);

create policy "Users can manage their own habit logs" on public.habit_logs
  for all using (auth.uid() = user_id);

create policy "Users can manage their own transactions" on public.transactions
  for all using (auth.uid() = user_id);

create policy "Users can manage their own journal entries" on public.journal_entries
  for all using (auth.uid() = user_id);

-- Create profile trigger on auth.users signup
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Grant privileges to authenticated and anon roles
grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;
