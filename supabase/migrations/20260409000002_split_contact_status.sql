-- Split lead status into two concerns:
-- 1. status (approval): new, approved, rejected, opted_out
-- 2. contact_status: none, contacted, followed_up, replied, interested
--
-- Migrates existing data from single status column to the new two-column model.

-- Add new column with default 'none'
ALTER TABLE leads ADD COLUMN contact_status text NOT NULL DEFAULT 'none';

-- Migrate existing contact-related statuses to contact_status column
UPDATE leads SET contact_status = 'contacted',  status = 'approved' WHERE status = 'contacted';
UPDATE leads SET contact_status = 'followed_up', status = 'approved' WHERE status = 'followed_up';
UPDATE leads SET contact_status = 'replied',     status = 'approved' WHERE status = 'replied';
UPDATE leads SET contact_status = 'interested',  status = 'approved' WHERE status = 'interested';

-- Normalize 'scored' to 'new' (scoring is reflected in the score column, not status)
UPDATE leads SET status = 'new' WHERE status = 'scored';

-- Index for filtering by contact_status
CREATE INDEX idx_leads_contact_status ON leads (contact_status);
