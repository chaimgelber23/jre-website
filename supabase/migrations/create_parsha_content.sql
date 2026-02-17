-- Create parsha_content table
CREATE TABLE IF NOT EXISTS public.parsha_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  parsha TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'practice',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parsha_content_parsha ON public.parsha_content (parsha);
CREATE INDEX IF NOT EXISTS idx_parsha_content_slug ON public.parsha_content (slug);
CREATE INDEX IF NOT EXISTS idx_parsha_content_status ON public.parsha_content (status);
CREATE INDEX IF NOT EXISTS idx_parsha_content_created_at ON public.parsha_content (created_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_parsha_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parsha_content_updated_at
  BEFORE UPDATE ON public.parsha_content
  FOR EACH ROW
  EXECUTE FUNCTION update_parsha_content_updated_at();

-- Enable RLS
ALTER TABLE public.parsha_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on parsha_content"
  ON public.parsha_content
  FOR SELECT
  USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on parsha_content"
  ON public.parsha_content
  FOR ALL
  USING (true)
  WITH CHECK (true);
