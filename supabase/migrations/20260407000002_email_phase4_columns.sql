-- supabase/migrations/20260407000002_email_phase4_columns.sql
-- Phase 4: Email infrastructure additions
-- Adds opened_at, start_history_id columns and FK constraint to email_events

ALTER TABLE email_events ADD COLUMN opened_at timestamptz;
ALTER TABLE email_events ADD COLUMN start_history_id text;
ALTER TABLE email_events
  ADD CONSTRAINT fk_email_events_template
  FOREIGN KEY (template_id) REFERENCES email_templates(id);
CREATE INDEX idx_email_events_sent_at ON email_events(sent_at);
