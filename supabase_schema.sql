-- OneCal Supabase Schema for Multi-User Sync & Cross-Device Storage

CREATE TABLE IF NOT EXISTS onecal_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_by_name TEXT,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  privacy TEXT DEFAULT 'shared', -- 'shared' | 'private'
  scope TEXT DEFAULT 'Internal', -- 'Internal' | 'External'
  mode TEXT DEFAULT 'Physical', -- 'Physical' | 'Virtual'
  location_region TEXT DEFAULT 'EMEA', -- 'EMEA' | 'Germany' | 'Americas' | 'APAC' | 'Global'
  city_venue TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  event_type TEXT DEFAULT 'Meeting', -- 'Portfolio' | 'Fair' | 'Meeting' | 'Campaign'
  vertical TEXT DEFAULT 'Cross Industry', -- 'CPG' | 'Auto' | 'A&D' | 'Electronics' | 'Life Sciences' | 'Data Centers' | 'Cross Industry'
  prep_days INTEGER DEFAULT 7,
  url TEXT,
  url_thumbnail TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  audio_notes JSONB DEFAULT '[]'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb,
  fiscal_year TEXT DEFAULT 'FY26',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE onecal_events ENABLE ROW LEVEL SECURITY;

-- Policies:
-- 1. Shared events can be seen and edited by any authenticated user
-- 2. Private events can only be seen and edited by their creator
CREATE POLICY "Select events" ON onecal_events
  FOR SELECT USING (
    privacy = 'shared' OR auth.uid()::text = user_id
  );

CREATE POLICY "Insert events" ON onecal_events
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id
  );

CREATE POLICY "Update events" ON onecal_events
  FOR UPDATE USING (
    privacy = 'shared' OR auth.uid()::text = user_id
  );

CREATE POLICY "Delete events" ON onecal_events
  FOR DELETE USING (
    auth.uid()::text = user_id
  );
