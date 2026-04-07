-- supabase/migrations/20260408000001_sequence_config.sql
-- MAIL-03: Sequence configuration singleton table
-- Stores global follow-up sequence settings (max steps, interval between sends)

CREATE TABLE sequence_config (
  id integer PRIMARY KEY DEFAULT 1,
  max_follow_ups integer NOT NULL DEFAULT 2,
  interval_days integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- Insert default row — the singleton row that the application reads/writes
INSERT INTO sequence_config (id, max_follow_ups, interval_days)
VALUES (1, 2, 5)
ON CONFLICT (id) DO NOTHING;
