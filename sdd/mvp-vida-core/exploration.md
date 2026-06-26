## Exploration: MVP Vida Core Architecture & Schema

### Current State
The project is currently empty, containing only a `.gitignore` and `.atl/skill-registry.md`. There are no configuration files, framework directories, or database schemas defined.

### Affected Areas
- `sdd/mvp-vida-core/exploration.md` — This exploration report file.
- `package.json` — Core dependencies for Next.js, Supabase, Tailwind, shadcn/ui, and the Telegram Bot SDK.
- `supabase/migrations/` — Supabase schema definitions, triggers, and Row Level Security (RLS) policies.
- `src/app/` — Next.js App Router structure, auth routes, dashboard modules, and API webhook routes.
- `src/lib/` — Integrations for Supabase clients (SSR config) and Telegram Bot controller.

### Approaches

#### 1. Next.js Webhook + App Router (Monolithic Serverless)
Process Telegram messages via a Next.js App Router API Route (`src/app/api/telegram/route.ts`). Next.js handles both the web dashboard and the Telegram webhook endpoint.
- **Pros**:
  - **Unified Types**: Shared TypeScript interfaces across the front-end, API, database layer, and Telegram parser.
  - **Simplicity**: Single command to run locally (`next dev`) and single target for deployment.
  - **Standard SSR Client**: Uses standard `@supabase/ssr` for server components, middleware, and route handlers.
- **Cons**:
  - Webhook execution limits: Serverless function timeouts could affect long-running message parsing (e.g., if adding heavy AI processing later).
- **Effort**: Low

#### 2. Decoupled Next.js Dashboard + Supabase Edge Functions (Deno)
Next.js handles the front-end dashboard, while Telegram webhooks are routed to a Supabase Edge Function written in Deno.
- **Pros**:
  - **Fast Execution**: Deno Edge Functions have near-zero cold starts.
  - **Decoupled Logic**: Separate scaling and error handling for the Telegram bot interface.
- **Cons**:
  - **Complex Setup**: Requires managing two separate runtimes (Node/Next.js and Deno/Supabase Edge Functions).
  - **Type Sharing Overhead**: Sharing database types or helper functions between Node/npm and Deno is cumbersome.
- **Effort**: Medium

---

### Recommendation
We recommend **Approach 1: Next.js Webhook + App Router (Monolithic Serverless)**. Since *Vida* is a personal life operating system, a unified codebase drastically reduces development friction, makes refactoring easier, and simplifies local development. We can handle Telegram timeouts by immediately acknowledging webhook requests and processing the actual logic asynchronously if necessary.

#### Proposed Project Structure
```text
vida/
├── .atl/                   # Agent team config
├── sdd/
│   └── mvp-vida-core/
│       └── exploration.md   # This report
├── supabase/
│   ├── config.toml
│   └── migrations/         # DB schema version control
│       └── 20260616000000_init_schema.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout (Tailwind, Providers)
│   │   ├── page.tsx        # Landing / Dashboard Overview
│   │   ├── (auth)/         # Group for login/register pages
│   │   ├── dashboard/      # Main application workspace
│   │   │   ├── tasks/
│   │   │   ├── habits/
│   │   │   └── journal/
│   │   └── api/
│   │       └── telegram/   # Webhook endpoint
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/             # shadcn/ui library components
│   │   ├── layout/         # Nav, Sidebar, Footer
│   │   └── dashboard/      # Custom task/habit components
│   ├── hooks/              # Custom React hooks (swr, react-query)
│   ├── lib/
│   │   ├── supabase/       # SSR client configurations (client, server, middleware)
│   │   └── telegram/       # Bot controllers and message command handlers
│   └── types/              # TS declarations
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

#### Proposed Supabase Schema
```sql
-- 1. Profiles (Linked to Supabase Auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  telegram_chat_id bigint unique,
  telegram_username text,
  timezone text default 'UTC' not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- 2. Raw Inbox/Inputs (Captures everything from Telegram or Quick Web Input)
create table public.inputs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  source text not null, -- 'telegram', 'web'
  content_type text not null, -- 'text', 'voice', 'image', 'url'
  raw_content jsonb not null, -- Store message objects or transcripts
  processed boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.inputs enable row level security;

-- 3. Tasks
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  status text check (status in ('todo', 'in_progress', 'done', 'archived')) default 'todo' not null,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

-- 4. Habits
create table public.habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  frequency text check (frequency in ('daily', 'weekly')) default 'daily' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.habits enable row level security;

-- 5. Habit Logs (Tracks daily/weekly completions)
create table public.habit_logs (
  id uuid default gen_random_uuid() primary key,
  habit_id uuid references public.habits(id) on delete cascade not null,
  completed_at date default current_date not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (habit_id, completed_at)
);

alter table public.habit_logs enable row level security;

-- 6. Journal Entries (Daily Reflections)
create table public.journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  entry_date date default current_date not null,
  content text not null,
  mood text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, entry_date)
);

alter table public.journal_entries enable row level security;
```

---

### Risks
- **Webhook Response Window**: Telegram webhooks must return a status `200 OK` quickly. If processing a message (e.g. transcribing audio, parsing text with AI) takes longer than 5-7 seconds, Telegram will retry the webhook. We must design `route.ts` to immediately validate the request, insert the message into `inputs`, return `200 OK`, and handle background processing asynchronously.
- **Supabase SSR Client Middleware Hook**: Ensuring proper redirect logic and cookie synchronization in Next.js Middleware is complex. We must strictly adhere to Supabase's `@supabase/ssr` documentation to avoid stale authentication states.
- **Telegram Bot Access Security**: Webhook endpoints are public. We must implement token verification (`/api/telegram?secret=YOUR_TELEGRAM_BOT_TOKEN`) or custom header checks to ensure requests only originate from official Telegram servers.

### Ready for Proposal
Yes — The architectural direction is solid. The next phase (`sdd-propose`) should draft the PRD, refine the data flow between Telegram webhook and Supabase, and detail user registration.
