CREATE TABLE public.hypotheses (
  id text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sid text NOT NULL,
  label text,
  file text NOT NULL,
  role_arn text NOT NULL,
  granted_actions text[] NOT NULL DEFAULT '{}',
  granted_resources text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  window_days int NOT NULL DEFAULT 14,
  used jsonb NOT NULL DEFAULT '[]',
  reduced jsonb,
  verdict text CHECK (verdict IN ('keep','reduce','remove')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','evidence','expired','pr_open','merged','kept_with_reason')),
  reduction_pr_url text,
  keep_reason text,
  last_checked_at timestamptz,
  reduced_at timestamptz
);

CREATE INDEX hypotheses_org_expires_idx ON public.hypotheses (org_id, expires_at);

GRANT SELECT, UPDATE ON public.hypotheses TO authenticated;
GRANT ALL ON public.hypotheses TO service_role;

ALTER TABLE public.hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org hypotheses select" ON public.hypotheses
  FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org hypotheses update" ON public.hypotheses
  FOR UPDATE TO authenticated USING (org_id = (SELECT public.current_org_id())) WITH CHECK (org_id = (SELECT public.current_org_id()));

CREATE TABLE public.agent_runs (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ran_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb
);

CREATE INDEX agent_runs_org_ran_idx ON public.agent_runs (org_id, ran_at DESC);

GRANT SELECT ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org agent runs select" ON public.agent_runs
  FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.hypotheses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;