-- AgentZap schema (idêntico ao Lovable Cloud, sem RLS)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  session_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  member_goal INTEGER,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, group_jid)
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  push_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_lid BOOLEAN NOT NULL DEFAULT false,
  lid_raw_id TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, phone_number)
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  name TEXT,
  age INTEGER,
  gender TEXT,
  state TEXT,
  city TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_gender ON leads(gender);

CREATE TABLE IF NOT EXISTS member_add_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  group_id UUID REFERENCES whatsapp_groups(id) ON DELETE SET NULL,
  group_name TEXT,
  target_count INTEGER NOT NULL DEFAULT 0,
  added_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'green',
  lead_ids JSONB NOT NULL DEFAULT '[]',
  log JSONB NOT NULL DEFAULT '[]',
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extraction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  group_id UUID REFERENCES whatsapp_groups(id) ON DELETE SET NULL,
  group_name TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
