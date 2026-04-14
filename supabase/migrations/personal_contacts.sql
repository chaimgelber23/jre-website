-- Personal contacts table (private to Chaim)
-- For tracking people met at Shabbos meals, events, etc.

CREATE TABLE IF NOT EXISTS personal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  how_met TEXT NOT NULL DEFAULT 'shabbos',  -- shabbos, event, shul, mutual_friend, other
  location TEXT,                              -- where you met (e.g. "Shabbos at the Cohens")
  notes TEXT,                                 -- any details about them
  follow_up TEXT,                             -- what to follow up on
  date_met DATE DEFAULT CURRENT_DATE,
  jewish_background TEXT,                     -- frum, traditional, secular, etc.
  spouse_name TEXT,
  kids TEXT,                                  -- e.g. "3 kids, oldest is 8"
  interests TEXT,                             -- hobbies, what they're into
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_personal_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_personal_contacts_updated_at
  BEFORE UPDATE ON personal_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_personal_contacts_updated_at();

-- RLS: block all public access (only service role key can access)
ALTER TABLE personal_contacts ENABLE ROW LEVEL SECURITY;

-- Index for searching
CREATE INDEX idx_personal_contacts_name ON personal_contacts(name);
CREATE INDEX idx_personal_contacts_how_met ON personal_contacts(how_met);
CREATE INDEX idx_personal_contacts_date_met ON personal_contacts(date_met DESC);
