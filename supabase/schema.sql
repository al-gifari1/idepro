-- ==============================================================================
-- IDEpro Supabase Database Schema & RLS Setup
-- Execute this SQL in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Create Profiles Table (Stores user tiers & gmail limits)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  tier text not null default 'free',
  gmail_limit integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- RLS Policies for Profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins / Service Role full access to profiles"
  on public.profiles for all
  using (true);

-- 2. Trigger: Automatically create a profile when a new user signs up in Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, tier, gmail_limit)
  values (
    new.id,
    new.email,
    'free',
    1
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Create Active Sessions Table (For Syncing Desktop App IDEpro sessions)
create table if not exists public.active_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text,
  tier text not null default 'free',
  gmail_limit integer not null default 1,
  active_gmail_count integer not null default 0,
  last_synced_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique index on email to allow upserting active session
create unique index if not exists active_sessions_email_idx on public.active_sessions (email);

-- Enable RLS on active_sessions
alter table public.active_sessions enable row level security;

-- RLS Policies for Active Sessions
create policy "Users can view active sessions"
  on public.active_sessions for select
  using (true);

create policy "Users can insert or update active sessions"
  on public.active_sessions for all
  using (true);
