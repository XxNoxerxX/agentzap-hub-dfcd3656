
-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Instâncias
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  session_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all instances" ON public.whatsapp_instances FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_instances_updated BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grupos
CREATE TABLE public.whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  name TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, group_jid)
);
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all groups" ON public.whatsapp_groups FOR ALL USING (true) WITH CHECK (true);

-- Membros
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  push_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_lid BOOLEAN NOT NULL DEFAULT false,
  lid_raw_id TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, phone_number)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all members" ON public.group_members FOR ALL USING (true) WITH CHECK (true);

-- Histórico
CREATE TABLE public.extraction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL,
  group_name TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.extraction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all history" ON public.extraction_history FOR ALL USING (true) WITH CHECK (true);

-- Buscas
CREATE TABLE public.group_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  dorks_generated JSONB,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all searches" ON public.group_searches FOR ALL USING (true) WITH CHECK (true);

-- Aquecedores
CREATE TABLE public.number_warmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle',
  messages_per_day INTEGER NOT NULL DEFAULT 20,
  total_days INTEGER NOT NULL DEFAULT 7,
  current_day INTEGER NOT NULL DEFAULT 0,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.number_warmers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all warmers" ON public.number_warmers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_warmers_updated BEFORE UPDATE ON public.number_warmers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Filtros
CREATE TABLE public.number_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  total_checked INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  filtered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.number_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all filters" ON public.number_filters FOR ALL USING (true) WITH CHECK (true);

-- Campanhas
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_numbers INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  interval_seconds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-resposta
CREATE TABLE public.auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL,
  response TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains',
  is_active BOOLEAN NOT NULL DEFAULT true,
  times_triggered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all rules" ON public.auto_reply_rules FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_rules_updated BEFORE UPDATE ON public.auto_reply_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Memória
CREATE TABLE public.memory_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'geral',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#a855f7',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.memory_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all notes" ON public.memory_notes FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.memory_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
