
-- Leads database
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  name TEXT,
  gender TEXT,
  state TEXT,
  city TEXT,
  age INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_gender ON public.leads(gender);
CREATE INDEX idx_leads_state ON public.leads(state);
CREATE INDEX idx_leads_city ON public.leads(city);
CREATE INDEX idx_leads_age ON public.leads(age);
GRANT ALL ON public.leads TO anon, authenticated, service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- Member add jobs
CREATE TABLE public.member_add_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID,
  group_id UUID,
  group_name TEXT,
  target_count INTEGER NOT NULL DEFAULT 0,
  added_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'green',
  lead_ids JSONB NOT NULL DEFAULT '[]',
  log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);
GRANT ALL ON public.member_add_jobs TO anon, authenticated, service_role;
ALTER TABLE public.member_add_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all add jobs" ON public.member_add_jobs FOR ALL USING (true) WITH CHECK (true);

-- Extend whatsapp_groups
ALTER TABLE public.whatsapp_groups
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_goal INTEGER;
