-- Add photos array column to store all listing images (not just thumbnail)
ALTER TABLE leads ADD COLUMN photos text[] NOT NULL DEFAULT '{}';

-- Backfill: copy existing thumbnail_url into photos array
UPDATE leads SET photos = ARRAY[thumbnail_url] WHERE thumbnail_url IS NOT NULL;
