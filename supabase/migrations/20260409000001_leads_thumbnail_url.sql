-- Add thumbnail_url column to leads table for listing preview images
ALTER TABLE leads ADD COLUMN IF NOT EXISTS thumbnail_url text;
