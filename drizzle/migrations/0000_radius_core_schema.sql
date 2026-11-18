-- ============ enums ============
CREATE TYPE public.resource_type AS ENUM ('service','role','database','storage','external');
CREATE TYPE public.sensitivity_level AS ENUM ('high','medium','low');
CREATE TYPE public.change_status AS ENUM ('pending','approved','blocked');
CREATE TYPE public.verdict_level AS ENUM ('high','medium','low');

-- ============ organizations ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ingest_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = (SELECT auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

CREATE INDEX profiles_org_idx ON public.profiles (org_id);

CREATE POLICY "org members read their org" ON public.organizations
  FOR SELECT TO authenticated USING (id = (SELECT public.current_org_id()));
CREATE POLICY "org members update their org" ON public.organizations
  FOR UPDATE TO authenticated USING (id = (SELECT public.current_org_id())) WITH CHECK (id = (SELECT public.current_org_id()));

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- ============ resources ============
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.resource_type NOT NULL DEFAULT 'service',
  sensitivity public.sensitivity_level NOT NULL DEFAULT 'low',
  tags TEXT[] NOT NULL DEFAULT '{}',
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org resources select" ON public.resources FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org resources insert" ON public.resources FOR INSERT TO authenticated WITH CHECK (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org resources update" ON public.resources FOR UPDATE TO authenticated USING (org_id = (SELECT public.current_org_id())) WITH CHECK (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org resources delete" ON public.resources FOR DELETE TO authenticated USING (org_id = (SELECT public.current_org_id()));

-- ============ edges ============
CREATE TABLE public.edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  to_resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, from_resource_id, to_resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edges TO authenticated;
GRANT ALL ON public.edges TO service_role;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org edges select" ON public.edges FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org edges insert" ON public.edges FOR INSERT TO authenticated WITH CHECK (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org edges delete" ON public.edges FOR DELETE TO authenticated USING (org_id = (SELECT public.current_org_id()));

-- ============ policy weights ============
CREATE TABLE public.policy_weights (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  threshold INTEGER NOT NULL DEFAULT 70,
  sens_high_weight INTEGER NOT NULL DEFAULT 14,
  sens_medium_weight INTEGER NOT NULL DEFAULT 7,
  sens_low_weight INTEGER NOT NULL DEFAULT 3,
  scope_bonus INTEGER NOT NULL DEFAULT 22,
  compliance_bonus INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.policy_weights TO authenticated;
GRANT ALL ON public.policy_weights TO service_role;
ALTER TABLE public.policy_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org weights select" ON public.policy_weights FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org weights insert" ON public.policy_weights FOR INSERT TO authenticated WITH CHECK (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org weights update" ON public.policy_weights FOR UPDATE TO authenticated USING (org_id = (SELECT public.current_org_id())) WITH CHECK (org_id = (SELECT public.current_org_id()));

-- ============ changes ============
CREATE TABLE public.changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'unknown',
  target_resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  new_access_resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  scope_broadened BOOLEAN NOT NULL DEFAULT false,
  status public.change_status NOT NULL DEFAULT 'pending',
  score INTEGER,
  verdict public.verdict_level,
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX changes_org_created_idx ON public.changes (org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.changes TO authenticated;
GRANT ALL ON public.changes TO service_role;
ALTER TABLE public.changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org changes select" ON public.changes FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org changes insert" ON public.changes FOR INSERT TO authenticated WITH CHECK (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org changes update" ON public.changes FOR UPDATE TO authenticated USING (org_id = (SELECT public.current_org_id())) WITH CHECK (org_id = (SELECT public.current_org_id()));

-- ============ audit log ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  change_id UUID REFERENCES public.changes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_created_idx ON public.audit_log (org_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org audit select" ON public.audit_log FOR SELECT TO authenticated USING (org_id = (SELECT public.current_org_id()));
CREATE POLICY "org audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (org_id = (SELECT public.current_org_id()));

-- ============ signup bootstrap: org + profile + weights + demo graph ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_name TEXT;
  r RECORD;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'user');

  INSERT INTO public.organizations (name) VALUES (v_name || '-org') RETURNING id INTO v_org;
  INSERT INTO public.profiles (id, org_id, display_name) VALUES (NEW.id, v_org, v_name);
  INSERT INTO public.policy_weights (org_id) VALUES (v_org);

  INSERT INTO public.resources (org_id, key, name, type, sensitivity, tags, x, y) VALUES
    (v_org,'iam-role-payments','iam-role:payments-role','role','high',ARRAY['prod'],450,230),
    (v_org,'payments-service','payments-service','service','high',ARRAY['prod'],290,150),
    (v_org,'auth-service','auth-service','service','high',ARRAY['prod'],290,320),
    (v_org,'admin-console','admin-console','service','high',ARRAY['prod','sensitive-access'],610,150),
    (v_org,'audit-log','audit-log','service','medium',ARRAY['compliance'],610,320),
    (v_org,'s3-payments-bucket','s3://payments-bucket','storage','high',ARRAY['prod','pii'],450,70),
    (v_org,'customer-db','customer-db','database','high',ARRAY['prod','pii','compliance'],450,400),
    (v_org,'billing-api','billing-api','service','high',ARRAY['prod'],130,70),
    (v_org,'notify-svc','notify-svc','service','low',ARRAY['prod'],130,230),
    (v_org,'cache-layer','cache-layer','service','low',ARRAY['prod'],20,20),
    (v_org,'third-party-webhook','webhook.partner.io','external','medium',ARRAY['external'],20,280),
    (v_org,'search-idx','search-idx','service','low',ARRAY['prod'],790,70),
    (v_org,'reporting-service','reporting-service','service','medium',ARRAY['prod'],790,230),
    (v_org,'s3-reports-bucket','s3://reports-bucket','storage','medium',ARRAY['prod'],790,400);

  FOR r IN SELECT * FROM (VALUES
    ('payments-service','iam-role-payments'),
    ('auth-service','iam-role-payments'),
    ('admin-console','iam-role-payments'),
    ('audit-log','iam-role-payments'),
    ('iam-role-payments','s3-payments-bucket'),
    ('billing-api','payments-service'),
    ('notify-svc','payments-service'),
    ('cache-layer','billing-api'),
    ('third-party-webhook','notify-svc'),
    ('search-idx','customer-db'),
    ('reporting-service','s3-payments-bucket'),
    ('reporting-service','s3-reports-bucket')
  ) AS e(f, t) LOOP
    INSERT INTO public.edges (org_id, from_resource_id, to_resource_id)
    SELECT v_org,
      (SELECT id FROM public.resources WHERE org_id = v_org AND key = r.f),
      (SELECT id FROM public.resources WHERE org_id = v_org AND key = r.t);
  END LOOP;

  INSERT INTO public.changes (org_id, title, author, target_resource_id, new_access_resource_id, scope_broadened)
  SELECT v_org, 'update-payments-iam-role', 'd.cohen',
    (SELECT id FROM public.resources WHERE org_id=v_org AND key='iam-role-payments'),
    (SELECT id FROM public.resources WHERE org_id=v_org AND key='customer-db'), true;
  INSERT INTO public.changes (org_id, title, author, target_resource_id, new_access_resource_id, scope_broadened)
  SELECT v_org, 'add-cache-ttl-config', 'r.levi',
    (SELECT id FROM public.resources WHERE org_id=v_org AND key='cache-layer'), NULL, false;
  INSERT INTO public.changes (org_id, title, author, target_resource_id, new_access_resource_id, scope_broadened)
  SELECT v_org, 'broaden-admin-console-access', 'n.katz',
    (SELECT id FROM public.resources WHERE org_id=v_org AND key='admin-console'),
    (SELECT id FROM public.resources WHERE org_id=v_org AND key='customer-db'), true;
  INSERT INTO public.changes (org_id, title, author, target_resource_id, new_access_resource_id, scope_broadened)
  SELECT v_org, 'rotate-webhook-secret', 'a.mizrahi',
    (SELECT id FROM public.resources WHERE org_id=v_org AND key='third-party-webhook'), NULL, false;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime
ALTER TABLE public.changes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.changes;