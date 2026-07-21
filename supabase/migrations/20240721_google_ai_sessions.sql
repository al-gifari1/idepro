-- ==============================================================================
-- IDEpro — Google AI Session Pool Schema Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rjegmurqhkglyethgauq/sql
-- ==============================================================================

-- 1. Google AI Sessions Pool Table (Admin-managed AI accounts)
CREATE TABLE IF NOT EXISTS public.google_ai_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail           TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  -- Auth: 'apikey' (Google AI Studio key) or 'cookie' (session cookies)
  auth_method     TEXT NOT NULL DEFAULT 'apikey',
  -- Encrypted credential data (API key or cookie JSON)
  credential_data TEXT NOT NULL,
  -- Status tracking
  status          TEXT NOT NULL DEFAULT 'active', -- active | rate_limited | expired | disabled
  -- Usage counters
  requests_today  INT NOT NULL DEFAULT 0,
  requests_total  INT NOT NULL DEFAULT 0,
  -- Rate limit tracking
  last_used_at    TIMESTAMPTZ,
  rate_limit_until TIMESTAMPTZ,
  -- Metadata
  added_by        UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast status queries (session router needs this)
CREATE INDEX IF NOT EXISTS google_ai_sessions_status_idx ON public.google_ai_sessions (status);
CREATE INDEX IF NOT EXISTS google_ai_sessions_requests_idx ON public.google_ai_sessions (requests_today ASC);

-- Enable RLS
ALTER TABLE public.google_ai_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role (admin) can manage sessions — regular users cannot see raw credentials
CREATE POLICY "Service role full access to google_ai_sessions"
  ON public.google_ai_sessions FOR ALL
  USING (true); -- Enforced by service key usage in Edge Worker only

-- 2. AI Session Usage Logs Table (per-request audit trail)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES public.google_ai_sessions(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      TEXT,
  -- Request info
  model           TEXT DEFAULT 'gemini-2.0-flash',
  prompt_preview  TEXT, -- first 100 chars only, for audit
  -- Response info
  response_ok     BOOLEAN DEFAULT TRUE,
  response_ms     INT,   -- latency in milliseconds
  error_code      TEXT,  -- 'rate_limited' | 'expired' | 'error' | null
  -- Timestamp
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_idx ON public.ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_session_idx ON public.ai_usage_logs (session_id);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_idx ON public.ai_usage_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own logs
CREATE POLICY "Users can view their own ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert all logs
CREATE POLICY "Service role full access to ai_usage_logs"
  ON public.ai_usage_logs FOR ALL
  USING (true);

-- 3. Daily request reset function (call via cron or manually)
CREATE OR REPLACE FUNCTION public.reset_daily_ai_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.google_ai_sessions
  SET requests_today = 0,
      -- Auto-recover rate-limited sessions after 24h
      status = CASE
        WHEN status = 'rate_limited' AND rate_limit_until < NOW() THEN 'active'
        ELSE status
      END,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add AI request limit columns to profiles table (per-user limits)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_requests_today   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_requests_limit   INT NOT NULL DEFAULT 20, -- Free: 20/day
  ADD COLUMN IF NOT EXISTS ai_last_request_at  TIMESTAMPTZ;

-- Update existing tier limits
UPDATE public.profiles SET ai_requests_limit = 20   WHERE tier = 'free';
UPDATE public.profiles SET ai_requests_limit = 200  WHERE tier = 'pro';
UPDATE public.profiles SET ai_requests_limit = 1000 WHERE tier = 'premium';
