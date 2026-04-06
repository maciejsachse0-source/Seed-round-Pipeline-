-- supabase/migrations/20260406000001_initial_schema.sql
-- Source: schema from .planning/research/ARCHITECTURE.md

-- Core lead data
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  phone text,
  city text,
  source_platform text NOT NULL,  -- 'olx' | 'facebook' | 'instagram' | 'google_maps'
  source_url text,
  business_description text,
  categories text[],
  price_range text,
  social_links jsonb,
  score integer,
  status text NOT NULL DEFAULT 'new',
  lawful_basis text NOT NULL DEFAULT 'legitimate_interest',  -- GDPR Art. 6(1)(f)
  opted_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email tracking
CREATE TABLE email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id uuid,               -- FK added in Phase 4 when templates table is guaranteed
  sequence_number integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  replied_at timestamptz,
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'replied' | 'bounced' | 'failed'
  gmail_message_id text,
  gmail_thread_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scraping jobs
CREATE TABLE scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  leads_found integer DEFAULT 0,
  leads_new integer DEFAULT 0,
  leads_duplicate integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_log text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Email templates
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,             -- supports {name}, {city}, {category} tokens
  sequence_position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Suppression list (GDPR opt-outs) — NEVER delete from this table
CREATE TABLE suppression_list (
  email text PRIMARY KEY,
  reason text NOT NULL,           -- 'opt_out' | 'bounce_hard' | 'spam_complaint' | 'manual'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_opted_out ON leads(opted_out) WHERE opted_out = true;
CREATE INDEX idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);

-- Trigger: auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
