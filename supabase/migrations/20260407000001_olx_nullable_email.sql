-- Phase 2: Allow null email for OLX-sourced leads (OLX uses in-platform messaging, no email exposed)
-- CRITICAL: Without this, all OLX lead inserts fail with NOT NULL constraint violation on email

ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;

-- Phone unique index (conditional — only unique when non-null, multiple NULLs allowed)
CREATE UNIQUE INDEX idx_leads_phone_unique ON leads (phone) WHERE phone IS NOT NULL;

-- Source URL unique index — prevents re-scraping same listing from creating duplicates
CREATE UNIQUE INDEX idx_leads_source_url ON leads (source_url) WHERE source_url IS NOT NULL;
