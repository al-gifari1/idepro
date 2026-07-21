-- ==============================================================================
-- IDEpro Supabase Database Schema & RLS Setup
-- ==============================================================================

-- ── 1. TABLE CREATIONS ────────────────────────────────────────────────────────

-- Profiles Table (Stores user tiers & gmail limits)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'free',
  gmail_limit INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active Sessions Table (For Syncing Desktop App IDEpro sessions)
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  access_token       TEXT NOT NULL,
  refresh_token      TEXT,
  tier               TEXT NOT NULL DEFAULT 'free',
  gmail_limit        INTEGER NOT NULL DEFAULT 1,
  active_gmail_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at     TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- GMAIL POOL TABLE — Admin-managed Gemini Gmail accounts
CREATE TABLE IF NOT EXISTS public.gmail_pool (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail                   TEXT NOT NULL UNIQUE,
  display_name            TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  access_token            TEXT,
  token_expires_at        BIGINT,
  status                  TEXT NOT NULL DEFAULT 'active',
  requests_today          INT NOT NULL DEFAULT 0,
  last_used_at            TIMESTAMPTZ,
  rate_limit_until        TIMESTAMPTZ,
  added_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- USER GMAIL ASSIGNMENTS — Which gmail accounts each user gets
CREATE TABLE IF NOT EXISTS public.user_gmail_assignments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    TEXT NOT NULL,
  gmail_id      UUID NOT NULL REFERENCES public.gmail_pool(id) ON DELETE CASCADE,
  priority      INT NOT NULL DEFAULT 1,
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_id),
  UNIQUE(user_id, priority)
);

-- GMAIL USAGE LOGS — Per-request audit trail per user per gmail
CREATE TABLE IF NOT EXISTS public.gmail_usage_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id      UUID REFERENCES public.gmail_pool(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model         TEXT DEFAULT 'gemini-2.0-flash',
  response_ok   BOOLEAN DEFAULT TRUE,
  response_ms   INT,
  error_code    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TIER → GMAIL SLOT MAPPING (stored as a config, easy to update)
CREATE TABLE IF NOT EXISTS public.tier_config (
  tier          TEXT PRIMARY KEY,
  gmail_slots   INT NOT NULL,
  daily_limit   INT NOT NULL
);


-- ── 2. INDEX CREATIONS ────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS active_sessions_email_idx ON public.active_sessions (email);
CREATE INDEX IF NOT EXISTS gmail_pool_status_idx ON public.gmail_pool (status);
CREATE INDEX IF NOT EXISTS gmail_pool_requests_idx ON public.gmail_pool (requests_today ASC);
CREATE INDEX IF NOT EXISTS user_gmail_assignments_user_idx ON public.user_gmail_assignments (user_id);
CREATE INDEX IF NOT EXISTS gmail_usage_logs_user_idx ON public.gmail_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS gmail_usage_logs_gmail_idx ON public.gmail_usage_logs (gmail_id);
CREATE INDEX IF NOT EXISTS gmail_usage_logs_date_idx ON public.gmail_usage_logs (created_at DESC);


-- ── 3. ROW LEVEL SECURITY (RLS) SETUP ─────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gmail_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_usage_logs ENABLE ROW LEVEL SECURITY;


-- ── 4. POLICY CREATIONS (IDEMPOTENT) ──────────────────────────────────────────

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins / Service Role full access to profiles" ON public.profiles;
CREATE POLICY "Admins / Service Role full access to profiles" ON public.profiles FOR ALL USING (true);

-- Active Sessions policies
DROP POLICY IF EXISTS "Users can view active sessions" ON public.active_sessions;
CREATE POLICY "Users can view active sessions" ON public.active_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert or update active sessions" ON public.active_sessions;
CREATE POLICY "Users can insert or update active sessions" ON public.active_sessions FOR ALL USING (true);

-- Gmail Pool policies
DROP POLICY IF EXISTS "Service role full access to gmail_pool" ON public.gmail_pool;
CREATE POLICY "Service role full access to gmail_pool" ON public.gmail_pool FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Users can view assigned gmail pools" ON public.gmail_pool;
CREATE POLICY "Users can view assigned gmail pools" ON public.gmail_pool FOR SELECT TO authenticated USING (
  id IN (
    SELECT gmail_id FROM public.user_gmail_assignments WHERE user_id = auth.uid()
  )
);

-- User Gmail Assignments policies
DROP POLICY IF EXISTS "Users can read their own gmail assignments" ON public.user_gmail_assignments;
CREATE POLICY "Users can read their own gmail assignments" ON public.user_gmail_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own gmail assignments" ON public.user_gmail_assignments;
CREATE POLICY "Users can delete their own gmail assignments" ON public.user_gmail_assignments FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to user_gmail_assignments" ON public.user_gmail_assignments;
CREATE POLICY "Service role full access to user_gmail_assignments" ON public.user_gmail_assignments FOR ALL TO service_role USING (true);

-- Gmail Usage Logs policies
DROP POLICY IF EXISTS "Users can read own usage logs" ON public.gmail_usage_logs;
CREATE POLICY "Users can read own usage logs" ON public.gmail_usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to gmail_usage_logs" ON public.gmail_usage_logs;
CREATE POLICY "Service role full access to gmail_usage_logs" ON public.gmail_usage_logs FOR ALL TO service_role USING (true);


-- ── 5. SEED CONFIG DATA ───────────────────────────────────────────────────────

INSERT INTO public.tier_config (tier, gmail_slots, daily_limit) VALUES
  ('free',    1, 20),
  ('pro',     3, 200),
  ('premium', 5, 1000)
ON CONFLICT (tier) DO UPDATE SET
  gmail_slots = EXCLUDED.gmail_slots,
  daily_limit = EXCLUDED.daily_limit;


-- ── 6. FUNCTIONS & TRIGGERS ───────────────────────────────────────────────────

-- Reset Counters
CREATE OR REPLACE FUNCTION public.reset_gmail_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE public.gmail_pool
  SET
    requests_today = 0,
    status = CASE
      WHEN status = 'rate_limited' AND rate_limit_until < NOW() THEN 'active'
      ELSE status
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-Assign Function
CREATE OR REPLACE FUNCTION public.auto_assign_gmails(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_email TEXT;
  v_tier TEXT;
  v_slots INT;
  v_assigned INT;
  v_gmail RECORD;
  v_priority INT := 1;
BEGIN
  SELECT email, tier INTO v_email, v_tier FROM public.profiles WHERE id = p_user_id;
  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  SELECT gmail_slots INTO v_slots FROM public.tier_config WHERE tier = v_tier;
  IF v_slots IS NULL THEN v_slots := 1; END IF;

  SELECT COUNT(*) INTO v_assigned FROM public.user_gmail_assignments WHERE user_id = p_user_id;

  IF v_assigned = v_slots THEN RETURN; END IF;

  IF v_assigned <> v_slots THEN
    DELETE FROM public.user_gmail_assignments WHERE user_id = p_user_id;
  END IF;

  FOR v_gmail IN
    SELECT gp.id
    FROM public.gmail_pool gp
    WHERE gp.status = 'active'
      AND (gp.rate_limit_until IS NULL OR gp.rate_limit_until < NOW())
      AND gp.id NOT IN (
        SELECT gmail_id FROM public.user_gmail_assignments WHERE user_id = p_user_id
      )
    ORDER BY gp.requests_today ASC, gp.last_used_at ASC NULLS FIRST
    LIMIT v_slots
  LOOP
    INSERT INTO public.user_gmail_assignments (user_id, user_email, gmail_id, priority)
    VALUES (p_user_id, v_email, v_gmail.id, v_priority)
    ON CONFLICT (user_id, gmail_id) DO NOTHING;
    v_priority := v_priority + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle Tier Change Trigger Function
CREATE OR REPLACE FUNCTION public.handle_tier_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    PERFORM public.auto_assign_gmails(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tier_change ON public.profiles;
CREATE TRIGGER on_tier_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_tier_change();

-- Handle New User Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier, gmail_limit)
  VALUES (
    new.id,
    new.email,
    'free',
    1
  )
  ON CONFLICT (id) DO NOTHING;
  
  PERFORM public.auto_assign_gmails(new.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto Confirm Trigger Function
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_signup_confirm ON auth.users;
CREATE TRIGGER on_auth_user_signup_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_user_email();
