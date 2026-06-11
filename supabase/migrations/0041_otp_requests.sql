-- =============================================================================
-- Migration 0041: otp_requests
--
-- Replaces the in-memory global.otpStore Map that breaks in multi-replica
-- deployments (Vercel, serverless). OTPs are stored as SHA-256 hashes —
-- the plaintext OTP is never persisted.
--
-- Lifecycle:
--   1. request-otp writes a row (upsert on email).
--   2. verify-otp reads + validates hash, then deletes the row on success.
--   3. A scheduled job (or Supabase cron) may DELETE WHERE expires_at < now()
--      to clean up expired rows, but the verify endpoint handles this too.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.otp_requests (
  email           TEXT        PRIMARY KEY,
  otp_hash        TEXT        NOT NULL,                  -- SHA-256(otp) hex
  expires_at      TIMESTAMPTZ NOT NULL,
  attempts        INT         NOT NULL DEFAULT 0,
  request_history TIMESTAMPTZ[]        DEFAULT '{}',     -- hourly rate-limit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS needed — this table is only accessed via createAdminClient()
-- (service-role key). It is never exposed to the browser directly.
ALTER TABLE public.otp_requests DISABLE ROW LEVEL SECURITY;

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires_at
  ON public.otp_requests (expires_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_otp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_otp_updated_at ON public.otp_requests;
CREATE TRIGGER trg_otp_updated_at
  BEFORE UPDATE ON public.otp_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_otp_updated_at();
