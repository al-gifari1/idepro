-- ==============================================================================
-- IDEpro — Gmail OAuth Pool Schema
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rjegmurqhkglyethgauq/sql
-- ==============================================================================

-- 1. GMAIL POOL TABLE — Admin-managed Gemini Gmail accounts
CREATE TABLE IF NOT EXISTS public.gmail_pool (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail                   TEXT NOT NULL UNIQUE,
  display_name            TEXT,                    -- Friendly label for admin
  -- OAuth tokens (encrypted AES-256 in Edge Worker before storing)
  encrypted_refresh_token TEXT NOT NULL,           -- Long-lived, encrypted
  access_token            TEXT,                    -- Short-lived, cached
  token_expires_at        BIGINT,                  -- Unix timestamp ms
  -- Status
  status                  TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'rate_limited' | 'expired' | 'disabled'
  -- Rate limit tracking
  requests_today          INT NOT NULL DEFAULT 0,
  last_used_at            TIMESTAMPTZ,
  rate_limit_until        TIMESTAMPTZ,             -- Auto-recover after this time
  -- Metadata
  added_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gmail_pool_status_idx ON public.gmail_pool (status);
CREATE INDEX IF NOT EXISTS gmail_pool_requests_idx ON public.gmail_pool (requests_today ASC);

ALTER TABLE public.gmail_pool ENABLE ROW LEVEL SECURITY;

-- Only service role (used by Edge Worker) can access raw tokens
CREATE POLICY "Service role full access to gmail_pool"
  ON public.gmail_pool FOR ALL
  USING (true);


-- 2. USER GMAIL ASSIGNMENTS — Which gmail accounts each user gets
CREATE TABLE IF NOT EXISTS public.user_gmail_assignments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id      UUID NOT NULL REFERENCES public.gmail_pool(id) ON DELETE CASCADE,
  priority      INT NOT NULL DEFAULT 1,   -- 1=primary, 2=first fallback, 3=second...
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_id),
  UNIQUE(user_id, priority)
);

CREATE INDEX IF NOT EXISTS user_gmail_assignments_user_idx ON public.user_gmail_assignments (user_id);

ALTER TABLE public.user_gmail_assignments ENABLE ROW LEVEL SECURITY;

-- Users can read their own assignments (for the desktop app sync)
CREATE POLICY "Users can read their own gmail assignments"
  ON public.user_gmail_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages all assignments
CREATE POLICY "Service role full access to user_gmail_assignments"
  ON public.user_gmail_assignments FOR ALL
  USING (true);


-- 3. GMAIL USAGE LOGS — Per-request audit trail per user per gmail
CREATE TABLE IF NOT EXISTS public.gmail_usage_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id      UUID REFERENCES public.gmail_pool(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model         TEXT DEFAULT 'gemini-2.0-flash',
  response_ok   BOOLEAN DEFAULT TRUE,
  response_ms   INT,
  error_code    TEXT,   -- 'rate_limited' | 'token_expired' | 'error'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gmail_usage_logs_user_idx ON public.gmail_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS gmail_usage_logs_gmail_idx ON public.gmail_usage_logs (gmail_id);
CREATE INDEX IF NOT EXISTS gmail_usage_logs_date_idx ON public.gmail_usage_logs (created_at DESC);

ALTER TABLE public.gmail_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage logs"
  ON public.gmail_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to gmail_usage_logs"
  ON public.gmail_usage_logs FOR ALL
  USING (true);


-- 4. TIER → GMAIL SLOT MAPPING (stored as a config, easy to update)
CREATE TABLE IF NOT EXISTS public.tier_config (
  tier          TEXT PRIMARY KEY,  -- 'free' | 'pro' | 'premium'
  gmail_slots   INT NOT NULL,      -- How many gmails to assign
  daily_limit   INT NOT NULL       -- Max Gemini requests per day for this tier
);

INSERT INTO public.tier_config (tier, gmail_slots, daily_limit) VALUES
  ('free',    1, 20),
  ('pro',     3, 200),
  ('premium', 5, 1000)
ON CONFLICT (tier) DO UPDATE SET
  gmail_slots = EXCLUDED.gmail_slots,
  daily_limit = EXCLUDED.daily_limit;


-- 5. RESET DAILY COUNTERS FUNCTION (call via pg_cron or manual trigger)
CREATE OR REPLACE FUNCTION public.reset_gmail_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE public.gmail_pool
  SET
    requests_today = 0,
    -- Auto-recover rate-limited sessions after 24h
    status = CASE
      WHEN status = 'rate_limited' AND rate_limit_until < NOW() THEN 'active'
      ELSE status
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. AUTO-ASSIGN GMAILS TO USER FUNCTION
-- Call this after user tier changes or first login
CREATE OR REPLACE FUNCTION public.auto_assign_gmails(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_tier TEXT;
  v_slots INT;
  v_assigned INT;
  v_gmail RECORD;
  v_priority INT := 1;
BEGIN
  -- Get user's tier
  SELECT tier INTO v_tier FROM public.profiles WHERE id = p_user_id;
  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  -- Get slot count for this tier
  SELECT gmail_slots INTO v_slots FROM public.tier_config WHERE tier = v_tier;
  IF v_slots IS NULL THEN v_slots := 1; END IF;

  -- Count existing assignments
  SELECT COUNT(*) INTO v_assigned FROM public.user_gmail_assignments WHERE user_id = p_user_id;

  -- If already has correct number, return
  IF v_assigned = v_slots THEN RETURN; END IF;

  -- Clear existing assignments if tier changed (different slot count)
  IF v_assigned <> v_slots THEN
    DELETE FROM public.user_gmail_assignments WHERE user_id = p_user_id;
  END IF;

  -- Assign least-used active gmails
  FOR v_gmail IN
    SELECT gp.id
    FROM public.gmail_pool gp
    WHERE gp.status = 'active'
      AND gp.id NOT IN (
        SELECT gmail_id FROM public.user_gmail_assignments WHERE user_id = p_user_id
      )
    ORDER BY gp.requests_today ASC, gp.last_used_at ASC NULLS FIRST
    LIMIT v_slots
  LOOP
    INSERT INTO public.user_gmail_assignments (user_id, gmail_id, priority)
    VALUES (p_user_id, v_gmail.id, v_priority)
    ON CONFLICT (user_id, gmail_id) DO NOTHING;
    v_priority := v_priority + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. TRIGGER: Auto-assign gmails when profile tier changes
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
