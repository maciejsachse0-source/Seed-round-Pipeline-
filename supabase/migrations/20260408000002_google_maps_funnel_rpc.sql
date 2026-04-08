-- Phase 6: Google Maps support + funnel analytics RPC
-- No CHECK constraint on leads.source_platform exists (verified: text NOT NULL column)
-- so no ALTER needed for google_maps values.

-- Funnel analytics: returns lead counts grouped by status and source_platform.
-- Called via supabase.rpc('get_funnel_counts') from the dashboard analytics page.
CREATE OR REPLACE FUNCTION get_funnel_counts()
RETURNS TABLE(status text, source_platform text, count bigint)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT status, source_platform, COUNT(*)::bigint
  FROM leads
  WHERE opted_out = false
  GROUP BY status, source_platform
  ORDER BY status, source_platform;
$$;
