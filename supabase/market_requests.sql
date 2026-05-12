-- ─────────────────────────────────────────────────────────────────
-- Market Requests table
-- Run this in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'Other',
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin queue (pending first)
CREATE INDEX IF NOT EXISTS market_requests_status_idx ON market_requests (status, created_at DESC);

-- RLS
ALTER TABLE market_requests ENABLE ROW LEVEL SECURITY;

-- Logged-in users can insert their own requests
CREATE POLICY "Users can submit requests"
ON market_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can see their own requests
CREATE POLICY "Users can view own requests"
ON market_requests FOR SELECT
USING (user_id = auth.uid());

-- Admins can see all requests
CREATE POLICY "Admins can view all requests"
ON market_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  )
);

-- Admins can update status (approve / reject)
CREATE POLICY "Admins can update request status"
ON market_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  )
);
