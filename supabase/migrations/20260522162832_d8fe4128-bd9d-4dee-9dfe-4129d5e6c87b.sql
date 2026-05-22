
CREATE TABLE public.validated_invites (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image TEXT,
  last_checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.validated_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all validated_invites" ON public.validated_invites FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_validated_invites_checked ON public.validated_invites(last_checked_at DESC);
