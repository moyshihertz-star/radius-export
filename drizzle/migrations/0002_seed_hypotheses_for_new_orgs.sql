CREATE OR REPLACE FUNCTION public.seed_demo_hypotheses(v_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.hypotheses (id, org_id, sid, label, file, role_arn, granted_actions, granted_resources, created_at, expires_at, window_days, used, reduced, verdict, status, reduction_pr_url, last_checked_at, reduced_at) VALUES
  (v_org || '#reports', v_org, 'RadiusHypothesis_14d_reports', 'reports', 'policies/payments-role.json',
   'arn:aws:iam::123456789012:role/payments-role',
   ARRAY['s3:*'], ARRAY['arn:aws:s3:::payments-bucket/*'],
   now() - interval '15 days', now() - interval '1 day', 14,
   '[{"action":"s3:GetObject","count":4012,"resources":["arn:aws:s3:::payments-bucket/invoices/*"],"last":"2026-09-04T08:12:00Z"},{"action":"s3:ListBucket","count":37,"resources":["arn:aws:s3:::payments-bucket"],"last":"2026-09-03T22:40:00Z"}]'::jsonb,
   '{"Action":["s3:GetObject","s3:ListBucket"],"Resource":["arn:aws:s3:::payments-bucket/invoices/*","arn:aws:s3:::payments-bucket"]}'::jsonb,
   'reduce', 'pr_open', 'https://github.com/acme/infra/pull/482', now() - interval '3 hours', NULL),

  (v_org || '#billing-export', v_org, 'RadiusHypothesis_14d_billing-export', 'billing-export', 'policies/billing-role.json',
   'arn:aws:iam::123456789012:role/billing-role',
   ARRAY['dynamodb:*','sqs:SendMessage'], ARRAY['arn:aws:dynamodb:eu-west-1:123456789012:table/invoices','arn:aws:sqs:eu-west-1:123456789012:billing-queue'],
   now() - interval '12 days', now() + interval '2 days', 14,
   '[{"action":"dynamodb:Query","count":880,"resources":["arn:aws:dynamodb:eu-west-1:123456789012:table/invoices"],"last":"2026-09-05T06:02:00Z"},{"action":"sqs:SendMessage","count":210,"resources":["arn:aws:sqs:eu-west-1:123456789012:billing-queue"],"last":"2026-09-05T05:58:00Z"}]'::jsonb,
   '{"Action":["dynamodb:Query","sqs:SendMessage"],"Resource":["arn:aws:dynamodb:eu-west-1:123456789012:table/invoices","arn:aws:sqs:eu-west-1:123456789012:billing-queue"]}'::jsonb,
   'reduce', 'evidence', NULL, now() - interval '2 hours', NULL),

  (v_org || '#incident-debug', v_org, 'RadiusHypothesis_7d_incident-debug', 'incident-debug', 'policies/oncall-role.json',
   'arn:aws:iam::123456789012:role/oncall-role',
   ARRAY['logs:*','ec2:Describe*'], ARRAY['*'],
   now() - interval '2 days', now() + interval '5 days', 7,
   '[{"action":"logs:FilterLogEvents","count":64,"resources":["arn:aws:logs:eu-west-1:123456789012:log-group:/aws/lambda/payments"],"last":"2026-09-05T09:10:00Z"}]'::jsonb,
   NULL, NULL, 'active', NULL, now() - interval '1 hour', NULL),

  (v_org || '#analytics-read', v_org, 'RadiusHypothesis_30d_analytics-read', 'analytics-read', 'policies/analytics-role.json',
   'arn:aws:iam::123456789012:role/analytics-role',
   ARRAY['athena:*','glue:GetTable','s3:GetObject'], ARRAY['arn:aws:s3:::reports-bucket/*'],
   now() - interval '9 days', now() + interval '21 days', 30,
   '[{"action":"athena:StartQueryExecution","count":140,"resources":["*"],"last":"2026-09-05T04:31:00Z"},{"action":"s3:GetObject","count":1520,"resources":["arn:aws:s3:::reports-bucket/daily/*"],"last":"2026-09-05T04:33:00Z"}]'::jsonb,
   NULL, NULL, 'active', NULL, now() - interval '5 hours', NULL),

  (v_org || '#legacy-admin', v_org, 'RadiusHypothesis_14d_legacy-admin', 'legacy-admin', 'policies/legacy-role.json',
   'arn:aws:iam::123456789012:role/legacy-migration-role',
   ARRAY['iam:*','s3:*'], ARRAY['*'],
   now() - interval '20 days', now() - interval '6 days', 14,
   '[]'::jsonb,
   '{"Action":[],"Resource":[]}'::jsonb,
   'remove', 'expired', NULL, now() - interval '6 hours', NULL),

  (v_org || '#search-index', v_org, 'RadiusVerified_search-index', 'search-index', 'policies/search-role.json',
   'arn:aws:iam::123456789012:role/search-role',
   ARRAY['s3:*','sqs:*'], ARRAY['arn:aws:s3:::search-bucket/*','*'],
   now() - interval '40 days', now() - interval '11 days', 30,
   '[{"action":"s3:GetObject","count":9800,"resources":["arn:aws:s3:::search-bucket/index/*"],"last":"2026-08-28T12:00:00Z"}]'::jsonb,
   '{"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::search-bucket/index/*"]}'::jsonb,
   'reduce', 'merged', 'https://github.com/acme/infra/pull/451', now() - interval '11 days', now() - interval '10 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.agent_runs (org_id, ran_at, summary) VALUES
  (v_org, now() - interval '3 hours', '{"scanned_policies":7,"hypotheses":6,"expired":2,"prs_opened":1,"cloudtrail_events":18422,"window":"24h"}'::jsonb),
  (v_org, now() - interval '1 day 3 hours', '{"scanned_policies":7,"hypotheses":6,"expired":1,"prs_opened":0,"cloudtrail_events":17110,"window":"24h"}'::jsonb),
  (v_org, now() - interval '2 days 3 hours', '{"scanned_policies":6,"hypotheses":5,"expired":1,"prs_opened":1,"cloudtrail_events":16044,"window":"24h"}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.seed_demo_hypotheses(v_org);

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_hypotheses(uuid) FROM PUBLIC, anon, authenticated;