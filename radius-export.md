# Radius — ייצוא מלא בקובץ אחד

הקובץ הזה מכיל את כל קוד הפרויקט + מסמך ההסבר, מאוחד לטקסט אחד.
כל קובץ מופיע תחת כותרת `=== path ===` ובתוך בלוק קוד.

---

# Radius — ייצוא מלא של הלוגיקה והקוד

הקובץ הזה מלווה את עותק הקוד המצורף ומסביר את כל מה שצריך כדי לשכפל את הפרויקט.
הקוד עצמו נמצא בתיקיות ליד המסמך הזה; המסמך מתעד את הלוגיקה, מבנה הנתונים, ואיך מקימים עותק עובד.

---

## 1. מה האפליקציה עושה

Radius היא קונסולת DevSecOps שמנתחת שינוי מתוכנן בתשתית ענן **לפני** שהוא יוצא לפרודקשן:

- **גרף תלויות** של משאבים (service / role / database / storage / external) עם קשרים מכוונים.
- **מנוע Blast Radius**: BFS הפוך מהמשאב המשתנה — מוצא את כל השירותים שתלויים בו עד 3 קפיצות, עם דעיכת משקל לפי מרחק.
- **ציון סיכון שקוף** (0–100) עם פירוט שורה-שורה, ו-verdict לפי סף: high / medium / low.
- **מסך היפותזות**: הרשאות שהוענקו זמנית עם חלון תפוגה, נתוני שימוש בפועל, diff בין "מה הוענק" ל"מה מוצע", ופעולה אחת — "השאר עם הצדקה".
- **מסך ריצות סוכן**: יומן הריצות של הסוכן החיצוני שמעדכן את ההיפותזות.
- **מסך מדיניות**: סליידרים לכיול משקלי הניקוד לכל ארגון, עם תצוגה מקדימה חיה.
- **Realtime**: שינוי סטטוס אצל משתמש אחד מתעדכן מיד אצל כל חברי הארגון.
- **דו-לשוני**: אנגלית כברירת מחדל, כפתור מעבר לעברית (RTL מלא) בראש הקונסולה.

## 2. ארכיטקטורה

- **TanStack Start v1** (React 19, Vite) — ראוטינג ב-`src/routes`, לוגיקת שרת ב-`createServerFn`.
- **Lovable Cloud (Supabase)** — דאטהבייס Postgres עם RLS, אימות אנונימי, Realtime.
- **המנוע רץ רק בשרת** (`src/lib/radius-engine.server.ts`) — הדפדפן לא יכול לזייף ציון.
- **עיצוב**: רקע כהה `#0B0F14`/`#121820`, accent כתום `#FF7A45`, Rubik לכותרות + Heebo לגוף. כל הצבעים מוגדרים כטוקנים ב-`src/radius.css` ו-`src/styles.css`.

### מבנה הקבצים המרכזי

```
src/
  lib/
    radius-engine.server.ts      ← מנוע BFS + ניקוד (שרת בלבד)
    radius-types.ts              ← טיפוסים: Resource, Edge, Weights, Change, Verdict
    radius.functions.ts          ← server functions: getConsole, createChange, decideChange, saveWeights, previewPolicy
    hypotheses-engine.server.ts  ← לוגיקת היפותזות (שרת)
    hypotheses.functions.ts      ← server functions: getHypotheses, keepWithReason, getAgentRuns
    hypotheses-types.ts          ← טיפוסי היפותזות + daysLeft helpers
    i18n.tsx                     ← מילון en/he, כפתור שפה, interpolation
  hooks/
    useConsole.ts                ← TanStack Query + מנוי Realtime (instance ID ייחודי!)
    useHypotheses.ts             ← אותו דפוס להיפותזות
  components/radius/
    GraphSvg.tsx                 ← גרף התלויות ב-SVG
    MapWalkthrough.tsx           ← הדגמה מונפשת שלב-אחר-שלב על הגרף
    ChangeDetail.tsx             ← פאנל פרטי שינוי: ציון, breakdown, משאבים מושפעים
    HypothesisDetail.tsx         ← פאנל היפותזה: הוענק / נצפה / diff מוצע
    NewChangeModal.tsx           ← יצירת שינוי ידנית
  routes/
    index.tsx                    ← דף נחיתה
    _authenticated/route.tsx     ← כניסה אנונימית אוטומטית (אין מסך הרשמה)
    _authenticated/app.tsx       ← מעטפת הקונסולה: טאבים + כפתור שפה
    _authenticated/app.changes.tsx   ← רשימת שינויים + פרטים
    _authenticated/app.map.tsx       ← מפת תלויות + walkthrough
    _authenticated/app.policy.tsx    ← סליידרי מדיניות
    _authenticated/app.hypotheses.tsx← מסך היפותזות
    _authenticated/app.runs.tsx      ← ריצות סוכן
drizzle/migrations/              ← 3 מיגרציות SQL (ראו סעיף 3)
```

## 3. מסד הנתונים (3 מיגרציות, לפי סדר)

### `0000_radius_core_schema.sql` — הליבה
- `organizations` (id, name, ingest_key) — ingest_key שמור ל-webhook עתידי (עדיין לא ממומש).
- `profiles` (id → auth.users, org_id, display_name).
- `resources` (id, org_id, key, name, type, sensitivity, tags[], x, y).
- `edges` (id, org_id, from_resource_id, to_resource_id) — קשר אחד בלבד, בלי סוג.
- `policy_weights` (org_id, threshold, sens_high/medium/low_weight, scope_bonus, compliance_bonus).
- `changes` (id, org_id, title, author, target_resource_id, new_access_resource_id, scope_broadened, status, score, verdict, breakdown jsonb, source, decided_by, decided_at, created_at).
- `audit_log` (id, org_id, change_id, action, actor_id, actor_name, details jsonb, created_at).
- RLS על כל טבלה דרך פונקציית security-definer שמחזירה את ה-org_id של המשתמש (מונע רקורסיה). GRANTs ל-authenticated ול-service_role.
- טריגר `handle_new_user` על auth.users: יוצר ארגון + פרופיל + **נתוני דמו** (14 משאבים, 12 קשרים, משקלי ברירת מחדל) לכל משתמש חדש.

### `0001_create_hypotheses.sql` — היפותזות
- `hypotheses` (org_id, sid, label, file, role_arn, granted_actions[], granted_resources[], used jsonb, reduced_actions[], reduced_resources[], verdict, status, reduction_pr_url, keep_reason, created_at, expires_at, last_checked_at).
- `agent_runs` (org_id, ran_at, summary).
- RLS + GRANTs + הוספה ל-publi­cation של Realtime.

### `0002_seed_hypotheses_for_new_orgs.sql` — דמו
- מעדכן את `handle_new_user` לזרוע גם 6 היפותזות ו-3 ריצות סוכן לכל ארגון חדש.

## 4. מנוע הניקוד — הנוסחה המדויקת

```
score = 15                                        # בסיס: שינוי בפרודקשן
      + 8                                         # אם היעד sensitivity = high
      + Σ weight(sensitivity) × hopWeight         # לכל צרכן שנמצא ב-BFS
      + scopeBonus (ברירת מחדל 22)                # אם scope_broadened = true
      + complianceBonus (ברירת מחדל 20)           # אם למשאב החדש יש תגית pii/compliance
score = min(100, round(score))

hopWeight:  hop 1 → 1.0,  hop 2 → 0.6,  hop 3 → 0.35
weights:    high 14, medium 7, low 3  (ברירת מחדל; ניתנים לכיול במסך מדיניות)

verdict:  score ≥ threshold (70)        → high
          score ≥ threshold × 0.55      → medium
          אחרת                          → low
```

- BFS הפוך על הקשתות (`to → from`), עומק קשיח 3, סיבוכיות O(hops × |E|).
- אם מוגדרת גישה חדשה, נוספת קשת זמנית `target → newAccess` לפני ה-BFS.
- **הציון מחושב מחדש בכל קריאה** (לא נקרא מהעמודה השמורה) — שינוי משקלים משנה רטרואקטיבית ציונים ישנים. זו התנהגות מכוונת של הדמו, שווה לדעת.
- טווחי clamp למשקלים: threshold 30–95, sensHigh 4–30, sensMedium 1–30, sensLow 0–30, בונוסים 0–40.

## 5. אימות ו-multi-tenancy

- אין מסך הרשמה: `_authenticated/route.tsx` קורא `signInAnonymously()` אם אין session.
- כל משתמש אנונימי מקבל ארגון משלו עם נתוני דמו (הטריגר מסעיף 3).
- RLS מבטיח שמשתמש רואה רק את שורות הארגון שלו.
- Realtime: כל hook פותח channel עם instance ID ייחודי (אל תחזירו topic קבוע — גורם לקריסות).

## 6. איך מקימים עותק עובד

1. **שכפלו את הפרויקט ב-Lovable** (Duplicate) — זו הדרך הקלה: הדאטהבייס והמיגרציות משוכפלות אוטומטית.
2. אם מקימים מאפס מהקוד הזה:
   - צרו פרויקט TanStack Start חדש והעתיקו את כל התיקיות כאן (אין `node_modules`, `.git`, `.env`, `routeTree.gen.ts` — אלו נוצרים מחדש).
   - `bun install` (הגרסאות נעולות ב-`bun.lock`).
   - הפעילו את 3 המיגרציות מ-`drizzle/migrations/` על בסיס הנתונים, **לפי הסדר**.
   - הגדירו `.env` עם `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` של הפרויקט החדש (ב-Lovable Cloud אלו נוצרים אוטומטית).
   - הפעילו כניסה אנונימית (Anonymous sign-ins) בהגדרות האימות.
   - הפעילו Realtime על הטבלאות `changes`, `hypotheses`, `agent_runs`.

## 7. מה עובד בפועל מול מה שעדיין לא (כנות)

| נושא | סטטוס |
|---|---|
| מנוע BFS + ניקוד בשרת | ✅ עובד, עם הנוסחה בסעיף 4 |
| RLS + multi-tenancy + דמו אוטומטי | ✅ עובד |
| Realtime בין חברי ארגון | ✅ עובד |
| מסכי changes / map / policy / hypotheses / runs | ✅ עובדים |
| i18n אנגלית/עברית + RTL | ✅ עובד |
| חיבור לענן אמיתי (AWS/GCP/Azure) | ❌ לא קיים — כל הנתונים מוזנים ידנית/דמו |
| נקודת קצה `/api/public/ingest` ל-webhook מ-CI | ❌ לא מומשה (ingest_key קיים בטבלה בלבד) |
| parsing של terraform plan / IAM policies | ❌ לא קיים — "wildcard" הוא checkbox ידני |
| בדיקות אוטומטיות למנוע | ❌ אין tests בפרויקט |
| הסוכן החיצוני שמעדכן היפותזות | ❌ חיצוני לאפליקציה; הנתונים כרגע seed |

---

# קוד המקור המלא

=== AGENTS.md ===
```
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
```

=== bunfig.toml ===
```
[install]
saveTextLockfile = true
# 24h supply-chain guard: skip package versions published less than a day ago.
minimumReleaseAge = 86400
# Each entry bypasses the 24h guard for one package — confirm with the user
# before adding any.
minimumReleaseAgeExcludes = ["@lovable.dev/vite-tanstack-config", "@lovable.dev/mcp-js", "@lovable.dev/email-js", "@lovable.dev/webhooks-js"]
```

=== components.json ===
```
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "src/styles.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}
```

=== drizzle.config.ts ===
```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
```

=== drizzle/migrations/0000_radius_core_schema.sql ===
```
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
GRANT SELECT ON public.organizations TO authenticated;
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
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "org members read their org" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.current_org_id());

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

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
CREATE POLICY "org resources select" ON public.resources FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org resources insert" ON public.resources FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org resources update" ON public.resources FOR UPDATE TO authenticated USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org resources delete" ON public.resources FOR DELETE TO authenticated USING (org_id = public.current_org_id());

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
CREATE POLICY "org edges select" ON public.edges FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org edges insert" ON public.edges FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org edges delete" ON public.edges FOR DELETE TO authenticated USING (org_id = public.current_org_id());

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
CREATE POLICY "org weights select" ON public.policy_weights FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org weights insert" ON public.policy_weights FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org weights update" ON public.policy_weights FOR UPDATE TO authenticated USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

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
GRANT SELECT, INSERT, UPDATE ON public.changes TO authenticated;
GRANT ALL ON public.changes TO service_role;
ALTER TABLE public.changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org changes select" ON public.changes FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org changes insert" ON public.changes FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "org changes update" ON public.changes FOR UPDATE TO authenticated USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

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
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org audit select" ON public.audit_log FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id());

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.changes;```

=== drizzle/migrations/0001_create_hypotheses.sql ===
```
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
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "org hypotheses update" ON public.hypotheses
  FOR UPDATE TO authenticated USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

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
  FOR SELECT TO authenticated USING (org_id = public.current_org_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.hypotheses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;```

=== drizzle/migrations/0002_seed_hypotheses_for_new_orgs.sql ===
```
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
$function$;```

=== drizzle/migrations/meta/0000_snapshot.json ===
```
{
  "id": "1617be42-d91c-46cf-928a-68b633d9338a",
  "prevId": "00000000-0000-0000-0000-000000000000",
  "version": "7",
  "dialect": "postgresql",
  "tables": {},
  "enums": {},
  "schemas": {},
  "views": {},
  "sequences": {},
  "roles": {},
  "policies": {},
  "_meta": {
    "columns": {},
    "schemas": {},
    "tables": {}
  }
}
```

=== drizzle/migrations/meta/0001_snapshot.json ===
```
{
  "id": "209f9a69-7f52-43e4-b2be-81b147f349dc",
  "prevId": "1617be42-d91c-46cf-928a-68b633d9338a",
  "version": "7",
  "dialect": "postgresql",
  "tables": {},
  "enums": {},
  "schemas": {},
  "views": {},
  "sequences": {},
  "roles": {},
  "policies": {},
  "_meta": {
    "columns": {},
    "schemas": {},
    "tables": {}
  }
}
```

=== drizzle/migrations/meta/0002_snapshot.json ===
```
{
  "id": "8deda0df-ec3e-426a-a387-0f9e5f6a88f3",
  "prevId": "209f9a69-7f52-43e4-b2be-81b147f349dc",
  "version": "7",
  "dialect": "postgresql",
  "tables": {},
  "enums": {},
  "schemas": {},
  "views": {},
  "sequences": {},
  "roles": {},
  "policies": {},
  "_meta": {
    "columns": {},
    "schemas": {},
    "tables": {}
  }
}
```

=== drizzle/migrations/meta/_journal.json ===
```
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1788219646201,
      "tag": "0000_radius_core_schema",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1788630890396,
      "tag": "0001_create_hypotheses",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "7",
      "when": 1788630944649,
      "tag": "0002_seed_hypotheses_for_new_orgs",
      "breakpoints": true
    }
  ]
}
```

=== drizzle/schema.ts ===
```
// auto-generated and intentionally left blank, do not edit
```

=== eslint.config.js ===
```
import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
```

=== .gitignore ===
```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
.output
.vinxi
.tanstack/**
.nitro
*.local

# Wrangler / Cloudflare
.wrangler/
.dev.vars

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

=== package.json ===
```
{
  "name": "tanstack_start_ts",
  "private": true,
  "sideEffects": false,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "overrides": {
    "rolldown": "1.2.1"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@lovable.dev/cloud-auth-js": "^1.0.0",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-aspect-ratio": "^1.1.8",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-menubar": "^1.1.16",
    "@radix-ui/react-navigation-menu": "^1.2.14",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@supabase/supabase-js": "^2.112.4",
    "@tailwindcss/vite": "^4.2.1",
    "@tanstack/react-query": "^5.101.1",
    "@tanstack/react-router": "1.170.18",
    "@tanstack/react-start": "1.168.32",
    "@tanstack/router-plugin": "1.168.23",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "embla-carousel-react": "^8.6.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.575.0",
    "react": "^19.2.0",
    "react-day-picker": "^9.14.0",
    "react-dom": "^19.2.0",
    "react-hook-form": "^7.71.2",
    "react-resizable-panels": "^4.6.5",
    "recharts": "^2.15.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.2.1",
    "tw-animate-css": "^1.3.4",
    "vaul": "^1.1.2",
    "vite-tsconfig-paths": "^6.0.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@lovable.dev/vite-tanstack-config": "2.26.5",
    "@types/node": "^22.16.5",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.2.0",
    "drizzle-kit": "^0.31.10",
    "drizzle-orm": "^0.45.2",
    "eslint": "^9.32.0",
    "eslint-config-prettier": "^10.1.1",
    "eslint-plugin-prettier": "^5.2.6",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^15.15.0",
    "nitro": "3.0.260603-beta",
    "postgres": "^3.4.9",
    "prettier": "^3.7.3",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.56.1",
    "vite": "8.1.5"
  }
}
```

=== .prettierignore ===
```
node_modules
dist
.output
.vinxi
pnpm-lock.yaml
package-lock.json
bun.lock
routeTree.gen.ts
```

=== .prettierrc ===
```
{
  "printWidth": 100,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

=== public/robots.txt ===
```
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
```

=== README.md ===
```
# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
```

=== src/components/radius/ChangeDetail.tsx ===
```
import { useMemo } from "react";
import { GraphSvg } from "./GraphSvg";
import { useI18n } from "@/lib/i18n";
import type { ConsoleData, RadiusChange } from "@/lib/radius-types";

interface Props {
  change: RadiusChange;
  data: ConsoleData;
  onDecide: (decision: "approved" | "blocked") => void;
  deciding: boolean;
}

export function ChangeDetail({ change, data, onDecide, deciding }: Props) {
  const { t, locale } = useI18n();
  const byId = useMemo(() => new Map(data.resources.map((r) => [r.id, r])), [data.resources]);
  const result = change.simulation;
  const targetNode = byId.get(change.targetResourceId);
  const newResourceNode = result.newResourceId ? byId.get(result.newResourceId) : null;

  const hitIds = new Set<string>([
    change.targetResourceId,
    ...result.consumers.map((c) => c.id),
    ...(newResourceNode ? [newResourceNode.id] : []),
  ]);

  const gaugeColor =
    result.verdict === "high"
      ? "var(--signal)"
      : result.verdict === "medium"
        ? "var(--warn)"
        : "var(--confirm)";

  return (
    <div className="panel">
      <div className="detail-top">
        <div>
          <div className="detail-title">{change.title}</div>
          <div className="detail-sub">
            {change.author} · {t("detail.target", { name: targetNode?.name ?? "—" })}
            {change.scopeBroadened ? t("detail.scope") : ""}
          </div>
        </div>
        <span className={`verdict-pill verdict-${result.verdict}`}>
          {t(`verdict.${result.verdict}`)}
        </span>
      </div>

      <div className="detail-body">
        <div>
          <div className="subcard">
            <h4>{t("detail.blast")}</h4>
            <GraphSvg
              resources={data.resources}
              edges={data.edges}
              highlight={{
                targetId: change.targetResourceId,
                hitIds,
                newAccessId: change.newAccessResourceId,
              }}
            />
          </div>
          <div className="subcard">
            <h4>
              {t("detail.impacted", {
                count: result.consumers.length + (newResourceNode ? 1 : 0),
              })}
            </h4>
            <ul className="imp-list">
              {newResourceNode && (
                <li className="imp-item">
                  <div>
                    <div>{newResourceNode.name}</div>
                    <div className="imp-reason">{t("detail.newAccessReason")}</div>
                  </div>
                  <span className={`badge badge-${newResourceNode.sensitivity}`}>
                    {t("detail.newResource")}
                  </span>
                </li>
              )}
              {result.consumers.length === 0 && !newResourceNode ? (
                <div className="empty-note">{t("detail.noDependents")}</div>
              ) : (
                result.consumers.map((c) => {
                  const n = byId.get(c.id);
                  if (!n) return null;
                  return (
                    <li className="imp-item" key={c.id}>
                      <div>
                        <div>{n.name}</div>
                        <div className="imp-reason">
                          {t("detail.dependsOn", {
                            name: targetNode?.name ?? "—",
                            hops: c.hop === 1 ? t("detail.hop") : t("detail.hops", { n: c.hop }),
                          })}
                        </div>
                      </div>
                      <span className={`badge badge-${n.sensitivity}`}>
                        {t(`sensitivity.${n.sensitivity}`)}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>

        <div>
          <div className="subcard">
            <h4>{t("detail.riskScore")}</h4>
            <div className="gauge-box">
              <svg width="150" height="80" viewBox="0 0 150 80">
                <path d="M10,75 A65,65 0 0,1 140,75" fill="none" stroke="#242D38" strokeWidth="11" />
                <path
                  d="M10,75 A65,65 0 0,1 140,75"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${(result.score / 100) * 204} 204`}
                />
              </svg>
              <div className="gauge-score" style={{ color: gaugeColor }}>
                {result.score}
              </div>
              <div className="gauge-verdict-label">
                {t("detail.outOf", { threshold: data.weights.threshold })}
              </div>
            </div>
          </div>
          <div className="subcard">
            <h4>{t("detail.breakdown")}</h4>
            {result.breakdown.map((b, i) => (
              <div className="breakdown-row" key={i}>
                <span>{b.key ? t(b.key, b.params) : b.label}</span>
                <span className="breakdown-pts">+{b.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="action-row">
        <button
          className="btn-approve"
          onClick={() => onDecide("approved")}
          disabled={deciding || change.status === "approved"}
        >
          {t("detail.approve")}
        </button>
        <button
          className="btn-block"
          onClick={() => onDecide("blocked")}
          disabled={deciding || change.status === "blocked"}
        >
          {t("detail.block")}
        </button>
        {change.decidedAt && (
          <span className="decided-note">
            {t(change.status === "approved" ? "detail.decidedApproved" : "detail.decidedBlocked", {
              date: new Date(change.decidedAt).toLocaleString(locale),
            })}
          </span>
        )}
      </div>
    </div>
  );
}
```

=== src/components/radius/GraphSvg.tsx ===
```
import { TYPE_COLOR, type RadiusEdge, type RadiusResource } from "@/lib/radius-types";

interface Highlight {
  targetId: string;
  hitIds: Set<string>;
  newAccessId: string | null;
}

interface GraphSvgProps {
  resources: RadiusResource[];
  edges: RadiusEdge[];
  highlight?: Highlight;
}

export function GraphSvg({ resources, edges, highlight }: GraphSvgProps) {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const edgesToDraw = edges.slice();
  const newEdge =
    highlight?.newAccessId != null
      ? { from: highlight.targetId, to: highlight.newAccessId }
      : null;
  if (newEdge) edgesToDraw.push(newEdge);

  return (
    <svg className="graph" viewBox="-40 0 980 460" xmlns="http://www.w3.org/2000/svg">
      {edgesToDraw.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const isNew = !!newEdge && e.from === newEdge.from && e.to === newEdge.to;
        const isHit = !!highlight && highlight.hitIds.has(e.from) && highlight.hitIds.has(e.to);
        const cls = isNew ? "gedge newedge" : isHit ? "gedge hit" : "gedge";
        return <line key={`${e.from}-${e.to}-${i}`} className={cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {resources.map((n) => {
        const isTarget = !!highlight && highlight.targetId === n.id;
        const isHit = !!highlight && highlight.hitIds.has(n.id) && !isTarget;
        const color = highlight
          ? isTarget
            ? "#FF7A45"
            : isHit
              ? n.sensitivity === "high"
                ? "#FF7A45"
                : "#F5C242"
              : "#2A3542"
          : TYPE_COLOR[n.type];
        const r = isTarget ? 11 : highlight ? 7 : 8;
        return (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={r}
              fill={color}
              stroke={highlight ? "none" : "#0B0F14"}
              strokeWidth={1.5}
            />
            <text
              className={`gnode-label ${isTarget || isHit || !highlight ? "hi" : ""}`}
              x={n.x}
              y={n.y - 14}
              textAnchor="middle"
            >
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

=== src/components/radius/HypothesisDetail.tsx ===
```
import { useEffect, useState } from "react";
import { useI18n, daysLeftKey } from "@/lib/i18n";
import { daysLeftTone, type Hypothesis } from "@/lib/hypotheses-types";

interface Props {
  hypothesis: Hypothesis;
  onKeep: (reason: string) => void;
  saving: boolean;
}

export function HypothesisDetail({ hypothesis, onKeep, saving }: Props) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState("");
  const h = hypothesis;

  useEffect(() => {
    setReason("");
  }, [h.id]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tone = daysLeftTone(h.daysLeft);
  const dl = daysLeftKey(h.daysLeft);

  return (
    <div className="panel">
      <div className="detail-top">
        <div>
          <div className="detail-title">{h.label ?? h.sid}</div>
          <div className="detail-sub">
            <span className="mono">{h.roleName}</span> ·{" "}
            {t("hyp.window", { days: h.windowDays, date: formatDate(h.lastCheckedAt) })}
          </div>
        </div>
        <div className="hyp-detail-tags">
          <span className={`days-pill days-${tone}`}>{t(dl.key, dl.params)}</span>
          <span className={`status-chip hyp-status-${h.status}`}>{t(`hypStatus.${h.status}`)}</span>
        </div>
      </div>

      <div className="hyp-detail-body">
        <div className="subcard diff-card">
          <h4>{t("hyp.diffTitle")}</h4>
          {h.diff.hasProposal ? (
            <p className="diff-note">
              {t("hyp.diffNote", {
                verdict: h.verdict ? t(`hypVerdict.${h.verdict}`) : t("hypVerdict.proposal"),
              })}
            </p>
          ) : (
            <p className="diff-note">{t("hyp.diffPending")}</p>
          )}

          <div className="diff-grid">
            <div>
              <div className="diff-col-title">Action</div>
              {h.diff.actions.length === 0 && (
                <div className="empty-note">{t("common.noValues")}</div>
              )}
              {h.diff.actions.map((line) => (
                <div key={`a-${line.value}`} className={`diff-line ${line.kept ? "keep" : "drop"}`}>
                  <span className="diff-sign">{line.kept ? "+" : "−"}</span>
                  <span className="mono">{line.value}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="diff-col-title">Resource</div>
              {h.diff.resources.length === 0 && (
                <div className="empty-note">{t("common.noValues")}</div>
              )}
              {h.diff.resources.map((line) => (
                <div key={`r-${line.value}`} className={`diff-line ${line.kept ? "keep" : "drop"}`}>
                  <span className="diff-sign">{line.kept ? "+" : "−"}</span>
                  <span className="mono">{line.value}</span>
                </div>
              ))}
            </div>
          </div>

          {h.reductionPrUrl && (
            <a className="pr-link" href={h.reductionPrUrl} target="_blank" rel="noreferrer">
              {t("hyp.prLink")}
            </a>
          )}
        </div>

        <div className="hyp-side">
          <div className="subcard">
            <h4>{t("hyp.observed")}</h4>
            {h.used.length === 0 ? (
              <div className="empty-note">{t("hyp.observedEmpty")}</div>
            ) : (
              <table className="used-table">
                <thead>
                  <tr>
                    <th>{t("hyp.thAction")}</th>
                    <th>{t("hyp.thCount")}</th>
                    <th>{t("hyp.thResources")}</th>
                    <th>{t("hyp.thLast")}</th>
                  </tr>
                </thead>
                <tbody>
                  {h.used.map((u) => (
                    <tr key={u.action}>
                      <td className="mono">{u.action}</td>
                      <td>{u.count.toLocaleString(locale)}</td>
                      <td className="mono used-res">{u.resources.join(", ") || "—"}</td>
                      <td>{formatDate(u.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="subcard">
            <h4>{t("hyp.granted")}</h4>
            <div className="granted-block">
              <div className="diff-col-title">Action</div>
              <div className="mono granted-list">{h.grantedActions.join(", ") || "—"}</div>
              <div className="diff-col-title">Resource</div>
              <div className="mono granted-list">{h.grantedResources.join(", ") || "—"}</div>
              <div className="diff-col-title">{t("hyp.file")}</div>
              <div className="mono granted-list">{h.file}</div>
            </div>
          </div>

          <div className="subcard">
            <h4>{t("hyp.keepTitle")}</h4>
            {h.keepReason ? (
              <div className="keep-reason-saved">
                <strong>{t("hyp.keepSaved")}</strong> {h.keepReason}
              </div>
            ) : null}
            <textarea
              className="keep-input"
              rows={3}
              placeholder={t("hyp.keepPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="btn-run"
              disabled={saving || reason.trim().length < 3}
              onClick={() => onKeep(reason.trim())}
            >
              {saving ? t("hyp.keepSaving") : t("hyp.keepAction")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

=== src/components/radius/MapWalkthrough.tsx ===
```
import { useEffect, useMemo, useState } from "react";
import { GraphSvg } from "./GraphSvg";
import { useI18n } from "@/lib/i18n";
import type { ConsoleData, RadiusChange } from "@/lib/radius-types";

const STEP_MS = 4200;
const TOTAL_STEPS = 5;

function pickExample(changes: RadiusChange[]): RadiusChange | null {
  return (
    changes.find((c) => c.scopeBroadened && c.newAccessResourceId) ??
    changes.find((c) => c.simulation.consumers.length > 0) ??
    changes[0] ??
    null
  );
}

export function MapWalkthrough({ data }: { data: ConsoleData }) {
  const { t } = useI18n();
  const example = useMemo(() => pickExample(data.changes), [data.changes]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      setStep((s) => {
        if (s >= TOTAL_STEPS - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, step]);

  if (!example) return <div className="empty-note">{t("walk.noData")}</div>;

  const byId = new Map(data.resources.map((r) => [r.id, r]));
  const sim = example.simulation;
  const targetName = byId.get(example.targetResourceId)?.name ?? "—";
  const accessName = example.newAccessResourceId
    ? (byId.get(example.newAccessResourceId)?.name ?? "—")
    : "—";

  const hop1 = sim.consumers.filter((c) => c.hop === 1);
  const deeper = sim.consumers.filter((c) => c.hop > 1);

  const hitIds = new Set<string>();
  if (step >= 1) hitIds.add(example.targetResourceId);
  if (step >= 2) hop1.forEach((c) => hitIds.add(c.id));
  if (step >= 3) deeper.forEach((c) => hitIds.add(c.id));
  if (step >= 4 && example.newAccessResourceId) hitIds.add(example.newAccessResourceId);

  const totalImpacted = sim.consumers.length + (example.newAccessResourceId ? 1 : 0);

  const bodies = [
    t("walk.s0.body", { target: targetName, access: accessName }),
    t("walk.s1.body", { target: targetName }),
    t("walk.s2.body", { target: targetName, count: hop1.length }),
    t("walk.s3.body", { count: deeper.length }),
    t("walk.s4.body", { count: totalImpacted, score: sim.score }),
  ];

  return (
    <div className="panel walk-panel">
      <div className="panel-head">
        <h3>{t("walk.title")}</h3>
        <span className="env-tag">{t("walk.step", { n: step + 1, total: TOTAL_STEPS })}</span>
      </div>

      <div className="walk-body">
        <div className="walk-graph">
          {step === 0 ? (
            <GraphSvg resources={data.resources} edges={data.edges} />
          ) : (
            <GraphSvg
              resources={data.resources}
              edges={data.edges}
              highlight={{
                targetId: example.targetResourceId,
                hitIds,
                newAccessId: step >= 4 ? example.newAccessResourceId : null,
              }}
            />
          )}
        </div>


        <div className="walk-side">
          <div className="walk-change mono">{example.title}</div>
          <div className="walk-step-title">{t(`walk.s${step}.title`)}</div>
          <p className="walk-step-body animate-fade-in" key={step}>
            {bodies[step]}
          </p>

          {step === TOTAL_STEPS - 1 && (
            <div className={`walk-verdict verdict-${sim.verdict}`}>{t(`verdict.${sim.verdict}`)}</div>
          )}

          <div className="walk-dots">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                className={`walk-dot ${i === step ? "on" : ""}`}
                aria-label={t("walk.step", { n: i + 1, total: TOTAL_STEPS })}
                onClick={() => {
                  setPlaying(false);
                  setStep(i);
                }}
              />
            ))}
          </div>

          <div className="walk-actions">
            <button
              className="btn-run"
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                  return;
                }
                if (step >= TOTAL_STEPS - 1) setStep(0);
                setPlaying(true);
              }}
            >
              {playing
                ? t("walk.pause")
                : step >= TOTAL_STEPS - 1
                  ? t("walk.replay")
                  : t("walk.play")}
            </button>
            <button
              className="btn-ghost"
              disabled={step >= TOTAL_STEPS - 1}
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
              }}
            >
              {t("walk.next")}
            </button>
          </div>

          <div className="walk-hint">{t("walk.hint")}</div>
        </div>
      </div>
    </div>
  );
}
```

=== src/components/radius/NewChangeModal.tsx ===
```
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { RadiusResource } from "@/lib/radius-types";

interface Props {
  resources: RadiusResource[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (v: {
    title: string;
    targetResourceId: string;
    newAccessResourceId: string | null;
    scopeBroadened: boolean;
  }) => void;
}

export function NewChangeModal({ resources, busy, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(resources[0]?.id ?? "");
  const [newAccess, setNewAccess] = useState("");
  const [scope, setScope] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("modal.title")}</h3>
        <div className="field">
          <label htmlFor="f_title">{t("modal.name")}</label>
          <input
            id="f_title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("modal.namePlaceholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="f_target">{t("modal.target")}</label>
          <select id="f_target" value={target} onChange={(e) => setTarget(e.target.value)}>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f_newaccess">{t("modal.newAccess")}</label>
          <select id="f_newaccess" value={newAccess} onChange={(e) => setNewAccess(e.target.value)}>
            <option value="">{t("modal.newAccessNone")}</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="checkfield">
          <input
            id="f_scope"
            type="checkbox"
            checked={scope}
            onChange={(e) => setScope(e.target.checked)}
          />
          <label htmlFor="f_scope" style={{ margin: 0 }}>
            {t("modal.scope")}
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button
            className="btn-run"
            type="button"
            disabled={busy || !target}
            onClick={() =>
              onSubmit({
                title,
                targetResourceId: target,
                newAccessResourceId: newAccess || null,
                scopeBroadened: scope,
              })
            }
          >
            {t("modal.run")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

=== src/components/radius/RadiusLogo.tsx ===
```
export function RadiusLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="#FF7A45" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#8D98A3" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="11" fill="none" stroke="#242D38" strokeWidth="1.2" />
    </svg>
  );
}
```

=== src/components/ui/accordion.tsx ===
```
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-sm font-medium cursor-pointer transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
```

=== src/components/ui/alert-dialog.tsx ===
```
import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
```

=== src/components/ui/alert.tsx ===
```
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
```

=== src/components/ui/aspect-ratio.tsx ===
```
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";

const AspectRatio = AspectRatioPrimitive.Root;

export { AspectRatio };
```

=== src/components/ui/avatar.tsx ===
```
"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
```

=== src/components/ui/badge.tsx ===
```
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

=== src/components/ui/breadcrumb.tsx ===
```
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<"ol">>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
        className,
      )}
      {...props}
    />
  ),
);
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<"li">>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />
  ),
);
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<"span">>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  ),
);
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
```

=== src/components/ui/button.tsx ===
```
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

=== src/components/ui/calendar.tsx ===
```
"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers["focused"]) ref.current?.focus();
  }, [modifiers]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers["selected"] &&
        !modifiers["range_start"] &&
        !modifiers["range_end"] &&
        !modifiers["range_middle"]
      }
      data-range-start={modifiers["range_start"]}
      data-range-end={modifiers["range_end"]}
      data-range-middle={modifiers["range_middle"]}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
```

=== src/components/ui/card.tsx ===
```
import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

=== src/components/ui/carousel.tsx ===
```
import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) {
      return;
    }

    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (!api || !setApi) {
      return;
    }

    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api?.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        ref={ref}
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
});
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div
          ref={ref}
          className={cn(
            "flex",
            orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-4" : "pt-4",
          className,
        )}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "absolute  h-8 w-8 rounded-full",
          orientation === "horizontal"
            ? "-left-12 top-1/2 -translate-y-1/2"
            : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        {...props}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only">Previous slide</span>
      </Button>
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "absolute h-8 w-8 rounded-full",
          orientation === "horizontal"
            ? "-right-12 top-1/2 -translate-y-1/2"
            : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        disabled={!canScrollNext}
        onClick={scrollNext}
        {...props}
      >
        <ArrowRight className="h-4 w-4" />
        <span className="sr-only">Next slide</span>
      </Button>
    );
  },
);
CarouselNext.displayName = "CarouselNext";

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
};
```

=== src/components/ui/chart.tsx ===
```
import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor = color || item.payload.fill || item.color;

              return (
                <div
                  key={item.dataKey}
                  className={cn(
                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                    indicator === "dot" && "items-center",
                  )}
                >
                  {formatter && item?.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn(
                              "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                              {
                                "h-2.5 w-2.5": indicator === "dot",
                                "w-1": indicator === "line",
                                "w-0 border-[1.5px] border-dashed bg-transparent":
                                  indicator === "dashed",
                                "my-0.5": nestLabel && indicator === "dashed",
                              },
                            )}
                            style={
                              {
                                "--color-bg": indicatorColor,
                                "--color-border": indicatorColor,
                              } as React.CSSProperties
                            }
                          />
                        )
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between leading-none",
                          nestLabel ? "items-end" : "items-center",
                        )}
                      >
                        <div className="grid gap-1.5">
                          {nestLabel ? tooltipLabel : null}
                          <span className="text-muted-foreground">
                            {itemConfig?.label || item.name}
                          </span>
                        </div>
                        {item.value && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {item.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean;
      nameKey?: string;
    }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegend";

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
```

=== src/components/ui/checkbox.tsx ===
```
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
```

=== src/components/ui/collapsible.tsx ===
```
"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
```

=== src/components/ui/command.tsx ===
```
"use client";

import * as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
```

=== src/components/ui/context-menu.tsx ===
```
import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin)",
      className,
    )}
    {...props}
  />
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin)",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold text-foreground", inset && "pl-8", className)}
    {...props}
  />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
```

=== src/components/ui/dialog.tsx ===
```
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

=== src/components/ui/drawer.tsx ===
```
import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
```

=== src/components/ui/dropdown-menu.tsx ===
```
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
```

=== src/components/ui/form.tsx ===
```
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
```

=== src/components/ui/hover-card.tsx ===
```
import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-hover-card-content-transform-origin)",
      className,
    )}
    {...props}
  />
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
```

=== src/components/ui/input-otp.tsx ===
```
import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName,
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index] ?? {
    char: null,
    hasFakeCaret: false,
    isActive: false,
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
```

=== src/components/ui/input.tsx ===
```
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

=== src/components/ui/label.tsx ===
```
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

=== src/components/ui/menubar.tsx ===
```
import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

function MenubarMenu({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu {...props} />;
}

function MenubarGroup({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group {...props} />;
}

function MenubarPortal({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal {...props} />;
}

function MenubarRadioGroup({ ...props }: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup {...props} />;
}

function MenubarSub({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(
      "flex h-9 items-center space-x-1 rounded-md border bg-background p-1 shadow-sm",
      className,
    )}
    {...props}
  />
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      className,
    )}
    {...props}
  />
));
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName;

const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </MenubarPrimitive.SubTrigger>
));
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName;

const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-menubar-content-transform-origin)",
      className,
    )}
    {...props}
  />
));
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName;

const MenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
  <MenubarPrimitive.Portal>
    <MenubarPrimitive.Content
      ref={ref}
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-menubar-content-transform-origin)",
        className,
      )}
      {...props}
    />
  </MenubarPrimitive.Portal>
));
MenubarContent.displayName = MenubarPrimitive.Content.displayName;

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
MenubarItem.displayName = MenubarPrimitive.Item.displayName;

const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
));
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName;

const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
));
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName;

const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
MenubarLabel.displayName = MenubarPrimitive.Label.displayName;

const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName;

const MenubarShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
};
MenubarShortcut.displayname = "MenubarShortcut";

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};
```

=== src/components/ui/navigation-menu.tsx ===
```
import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn("group flex flex-1 list-none items-center justify-center space-x-1", className)}
    {...props}
  />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent",
);

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}{" "}
    <ChevronDown
      className="relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto ",
      className,
    )}
    {...props}
  />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className={cn("absolute left-0 top-full flex justify-center")}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  </div>
));
NavigationMenuViewport.displayName = NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
      className,
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </NavigationMenuPrimitive.Indicator>
));
NavigationMenuIndicator.displayName = NavigationMenuPrimitive.Indicator.displayName;

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
};
```

=== src/components/ui/pagination.tsx ===
```
import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonProps, buttonVariants } from "@/components/ui/button";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />,
);
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">;

const PaginationLink = ({ className, isActive, size = "icon", ...props }: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
```

=== src/components/ui/popover.tsx ===
```
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-popover-content-transform-origin)",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
```

=== src/components/ui/progress.tsx ===
```
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

=== src/components/ui/radio-group.tsx ===
```
import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
```

=== src/components/ui/resizable.tsx ===
```
import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof Group>) => (
  <Group
    className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
```

=== src/components/ui/scroll-area.tsx ===
```
import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
```

=== src/components/ui/select.tsx ===
```
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background cursor-pointer data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-select-content-transform-origin)",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
```

=== src/components/ui/separator.tsx ===
```
import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className,
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

=== src/components/ui/sheet.tsx ===
```
"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
```

=== src/components/ui/sidebar.tsx ===
```
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(openState);
        } else {
          _setOpen(openState);
        }

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open],
    );

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
    }, [isMobile, setOpen, setOpenMobile]);

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          toggleSidebar();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed";

    const contextValue = React.useMemo<SidebarContextProps>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
              className,
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "offcanvas",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      );
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription>Displays the mobile sidebar.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <div
        ref={ref}
        className="group peer hidden text-sidebar-foreground md:block"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
              : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          )}
        />
        <div
          className={cn(
            "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            // Adjust the padding for floating and inset variants.
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
              : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className,
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
          >
            {children}
          </div>
        </div>
      </div>
    );
  },
);
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <button
        ref={ref}
        data-sidebar="rail"
        aria-label="Toggle Sidebar"
        tabIndex={-1}
        onClick={toggleSidebar}
        title="Toggle Sidebar"
        className={cn(
          "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
          "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
          "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
          "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
          "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
          "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<"main">>(
  ({ className, ...props }, ref) => {
    return (
      <main
        ref={ref}
        className={cn(
          "relative flex w-full flex-1 flex-col bg-background",
          "md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarInset.displayName = "SidebarInset";

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      {...props}
    />
  );
});
SidebarInput.displayName = "SidebarInput";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="header"
        className={cn("flex flex-col gap-2 p-2", className)}
        {...props}
      />
    );
  },
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="footer"
        className={cn("flex flex-col gap-2 p-2", className)}
        {...props}
      />
    );
  },
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  );
});
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="content"
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="group"
        className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
        {...props}
      />
    );
  },
);
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring cursor-pointer transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarGroupAction.displayName = "SidebarGroupAction";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  ),
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  ),
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  ),
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring cursor-pointer transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const { isMobile, state } = useSidebar();

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    );

    if (!tooltip) {
      return button;
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      };
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== "collapsed" || isMobile}
          {...tooltip}
        />
      </Tooltip>
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    showOnHover?: boolean;
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring cursor-pointer transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuAction.displayName = "SidebarMenuAction";

const SidebarMenuBadge = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean;
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
});
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ ...props }, ref) => <li ref={ref} {...props} />,
);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean;
    size?: "sm" | "md";
    isActive?: boolean;
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
```

=== src/components/ui/skeleton.tsx ===
```
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

export { Skeleton };
```

=== src/components/ui/slider.tsx ===
```
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
```

=== src/components/ui/sonner.tsx ===
```
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
```

=== src/components/ui/switch.tsx ===
```
import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
```

=== src/components/ui/table.tsx ===
```
import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
```

=== src/components/ui/tabs.tsx ===
```
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

=== src/components/ui/textarea.tsx ===
```
import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
```

=== src/components/ui/toggle-group.tsx ===
```
"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
```

=== src/components/ui/toggle.tsx ===
```
import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
```

=== src/components/ui/tooltip.tsx ===
```
"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-tooltip-content-transform-origin)",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

=== src/hooks/useConsole.ts ===
```
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getConsole } from "@/lib/radius.functions";
import type { ConsoleData } from "@/lib/radius-types";

export const CONSOLE_QUERY_KEY = ["radius", "console"] as const;

export function useConsole() {
  const fetchConsole = useServerFn(getConsole);
  const queryClient = useQueryClient();

  const query = useQuery<ConsoleData>({
    queryKey: CONSOLE_QUERY_KEY,
    queryFn: () => fetchConsole(),
  });

  useEffect(() => {
    // Unique topic per hook instance: several components use this hook at once,
    // and reusing one topic makes the second subscription throw.
    const channel = supabase
      .channel(`radius-console-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "changes" }, () => {
        queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "policy_weights" }, () => {
        queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
```

=== src/hooks/useHypotheses.ts ===
```
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAgentRuns, getHypotheses } from "@/lib/hypotheses.functions";
import type { AgentRun, HypothesesData } from "@/lib/hypotheses-types";

export const HYPOTHESES_QUERY_KEY = ["radius", "hypotheses"] as const;
export const AGENT_RUNS_QUERY_KEY = ["radius", "agent-runs"] as const;

function useRealtime(tables: string[], keys: readonly (readonly string[])[]) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");

  useEffect(() => {
    const channel = supabase.channel(`radius-hyp-${Math.random().toString(36).slice(2)}`);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tableKey]);
}

export function useHypotheses() {
  const fetchHypotheses = useServerFn(getHypotheses);
  useRealtime(["hypotheses"], [HYPOTHESES_QUERY_KEY]);

  return useQuery<HypothesesData>({
    queryKey: HYPOTHESES_QUERY_KEY,
    queryFn: () => fetchHypotheses(),
  });
}

export function useAgentRuns() {
  const fetchRuns = useServerFn(getAgentRuns);
  useRealtime(["agent_runs"], [AGENT_RUNS_QUERY_KEY]);

  return useQuery<AgentRun[]>({
    queryKey: AGENT_RUNS_QUERY_KEY,
    queryFn: () => fetchRuns(),
  });
}
```

=== src/hooks/use-mobile.tsx ===
```
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
```

=== src/integrations/lovable/index.ts ===
```
// This file is auto-generated by Lovable. Do not modify it.

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";
const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        ...opts,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
```

=== src/integrations/supabase/auth-attacher.ts ===
```
// This file is automatically generated. Do not edit it directly.
import { createMiddleware } from '@tanstack/react-start'
import { supabase } from './client'

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
```

=== src/integrations/supabase/auth-middleware.ts ===
```
// This file is automatically generated. Do not edit it directly.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'



function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    
    const SUPABASE_URL = process.env['SUPABASE_URL'];
    const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'];

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }
    
    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    if (token.split('.').length !== 3) {
      throw new Error('Unauthorized: Invalid token');
    }

    const supabase = createClient<Database>(
      SUPABASE_URL!,
      SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY!),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throw new Error('Unauthorized: Invalid token');
    }

    if (!data.claims.sub) {
      throw new Error('Unauthorized: No user ID found in token');
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);
```

=== src/integrations/supabase/client.server.ts ===
```
// This file is automatically generated. Do not edit it directly.
// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
```

=== src/integrations/supabase/client.ts ===
```
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}


function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

```

=== src/integrations/supabase/cron-auth.ts ===
```
// This file is automatically generated. Do not edit it directly.
export async function authenticateCronRequest(
  request: Request,
): Promise<Response | null> {
  const currentSecret = process.env['LOVABLE_CRON_SECRET']
  const previousSecret = process.env['LOVABLE_CRON_SECRET_PREVIOUS']

  if (!currentSecret) {
    return new Response('Server configuration error', { status: 500 })
  }

  const match = /^Bearer ([^\s,]+)$/.exec(
    request.headers.get('authorization') ?? '',
  )
  const token = match?.[1]
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { createHash, timingSafeEqual } = await import('node:crypto')
  const digest = (value: string) =>
    createHash('sha256').update(value, 'utf8').digest()
  const providedDigest = digest(token)
  const currentMatches = timingSafeEqual(providedDigest, digest(currentSecret))
  const previousMatches = timingSafeEqual(
    providedDigest,
    digest(previousSecret ?? currentSecret),
  )

  if (!currentMatches && !previousMatches) {
    return new Response('Unauthorized', { status: 401 })
  }

  return null
}
```

=== src/integrations/supabase/previewAuthStorage.ts ===
```
// This file is automatically generated. Do not edit it directly.

/** Storage accepted by Supabase's `auth.storage` option; `localStorage` and the editor broker both satisfy it. */
export interface PreviewAuthStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

type BrokerRequestType = 'lovable-preview-auth:get' | 'lovable-preview-auth:set' | 'lovable-preview-auth:remove';

interface BrokerRequest {
  type: BrokerRequestType;
  requestId: string;
  projectId: string;
  key: string;
  value?: string;
}

interface BrokerReply {
  ok: boolean;
  value: string | null;
}

const RESULT = 'lovable-preview-auth:result';

function readBrokerReply(data: unknown, requestId: string): BrokerReply | null {
  if (typeof data !== 'object' || data === null) return null;
  if (!('type' in data) || data.type !== RESULT) return null;
  if (!('requestId' in data) || data.requestId !== requestId) return null;
  return {
    ok: 'ok' in data && Boolean(data.ok),
    value: 'value' in data && typeof data.value === 'string' ? data.value : null,
  };
}

/**
 * On a Lovable preview surface, broker the auth session to the editor over
 * postMessage so the project's preview surfaces share one login; else localStorage.
 */
export function brokeredPreviewStorage(): PreviewAuthStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = location.hostname;
  const PREVIEW_ZONES = ['lovableproject.com', 'lovableproject-dev.com', 'lovable.app', 'gpt-eng.com', 'gptengineer.run'];
  const onPreviewZone = PREVIEW_ZONES.some((z) => host === z || host.endsWith('.' + z));
  // Read the id only from non-user-controlled host positions, so a user-named
  // preview--<name> host can't smuggle another project's id.
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const projectId = onPreviewZone
    ? (new RegExp('^(?:id-preview(?:-[a-z0-9]+)?|project)--(' + UUID + ')(?:-dev)?(?=\\.|$)', 'i').exec(host)?.[1]
        ?? new RegExp('^(' + UUID + ')(?=[.-])', 'i').exec(host)?.[1])
    : undefined;
  // lib.dom types window.parent and location.ancestorOrigins as always set, but a
  // detached frame has no parent and not every browser implements ancestorOrigins.
  const parentWindow = window.parent as Window | null;
  const framed = parentWindow !== null && parentWindow !== window;
  if (!projectId || !framed) return localStorage;

  // Post only to the real editor ancestor, validated as a Lovable origin, so the
  // session token can never reach an untrusted embedder.
  const dev = host.endsWith('.lovableproject-dev.com') || host.endsWith('.gpt-eng.com');
  const EDITOR = dev
    ? /^https:\/\/([a-z0-9-]+\.)*(lovable\.dev|gptengineer\.app)$|^http:\/\/localhost:3000$/
    : /^https:\/\/([a-z0-9-]+\.)*(lovable\.dev|gptengineer\.app)$/;
  const ancestorOrigins = location.ancestorOrigins as DOMStringList | undefined;
  const ancestor = ancestorOrigins?.[0] ?? (document.referrer ? new URL(document.referrer).origin : '');
  const editorOrigins = ancestor && EDITOR.test(ancestor)
    ? [ancestor]
    : (dev ? ['https://lovable.dev', 'http://localhost:3000'] : ['https://lovable.dev']);
  const TIMEOUT = 2000;
  const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const request = (type: BrokerRequestType, key: string, value?: string): Promise<BrokerReply | null> =>
    new Promise((resolve) => {
      const requestId = newId();
      let done = false;
      const finish = (reply: BrokerReply | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(reply);
      };
      const onMessage = (e: MessageEvent<unknown>) => {
        if (!editorOrigins.includes(e.origin)) return;
        const reply = readBrokerReply(e.data, requestId);
        if (reply) finish(reply);
      };
      window.addEventListener('message', onMessage);
      const timer = setTimeout(() => { finish(null); }, TIMEOUT);
      const msg: BrokerRequest = { type, requestId, projectId, key };
      if (value !== undefined) msg.value = value;
      // targetOrigin per trusted editor origin, so a session token never reaches an arbitrary embedder.
      for (const origin of editorOrigins) window.parent.postMessage(msg, origin);
    });

  // The editor may not be listening yet at the first getItem, so retry once.
  let firstGet = true;
  const RETRY_DELAY = 250;
  // Blocked third-party storage throws here; seeding must not break broker reads.
  const readLocal = (key: string): string | null | undefined => { try { return localStorage.getItem(key); } catch { return undefined; } };

  return {
    getItem: async (key) => {
      // Sent with GET and REMOVE so an editor that never cached this session can check or revoke it.
      const local = readLocal(key);
      let res = await request('lovable-preview-auth:get', key, local ?? undefined);
      if (!res && firstGet) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY));
        res = await request('lovable-preview-auth:get', key, local ?? undefined);
      }
      firstGet = false;
      // '' is the logout tombstone: clear the local copy too so it can't resurrect if
      // the broker later goes silent. A null value means never-synced -> keep local.
      if (res?.ok && res.value !== null) {
        if (res.value === '') {
          if (local !== undefined && readLocal(key) === local) localStorage.removeItem(key);
          return null;
        }
        // Seed this origin so a new tab, whose editor holds no session, stays signed in.
        if (local === null && readLocal(key) === null) {
          try { localStorage.setItem(key, res.value); } catch { /* storage full: still return the editor's session */ }
        }
        return res.value;
      }
      return localStorage.getItem(key);
    },
    setItem: (key, value) => {
      localStorage.setItem(key, value);
      return request('lovable-preview-auth:set', key, value).then((res) => {
        if (res?.ok && res.value !== null && localStorage.getItem(key) === value) {
          if (res.value === '') localStorage.removeItem(key);
          else localStorage.setItem(key, res.value);
        }
      });
    },
    removeItem: (key) => {
      const local = readLocal(key);
      localStorage.removeItem(key);
      return request('lovable-preview-auth:remove', key, local ?? undefined).then(() => {});
    },
  };
}
```

=== src/integrations/supabase/types.ts ===
```
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          id: number
          org_id: string
          ran_at: string
          summary: Json | null
        }
        Insert: {
          id?: number
          org_id: string
          ran_at?: string
          summary?: Json | null
        }
        Update: {
          id?: number
          org_id?: string
          ran_at?: string
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          change_id: string | null
          created_at: string
          details: Json
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          change_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          change_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: false
            referencedRelation: "changes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      changes: {
        Row: {
          author: string
          breakdown: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          new_access_resource_id: string | null
          org_id: string
          scope_broadened: boolean
          score: number | null
          source: string
          status: Database["public"]["Enums"]["change_status"]
          target_resource_id: string
          title: string
          verdict: Database["public"]["Enums"]["verdict_level"] | null
        }
        Insert: {
          author?: string
          breakdown?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          new_access_resource_id?: string | null
          org_id: string
          scope_broadened?: boolean
          score?: number | null
          source?: string
          status?: Database["public"]["Enums"]["change_status"]
          target_resource_id: string
          title: string
          verdict?: Database["public"]["Enums"]["verdict_level"] | null
        }
        Update: {
          author?: string
          breakdown?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          new_access_resource_id?: string | null
          org_id?: string
          scope_broadened?: boolean
          score?: number | null
          source?: string
          status?: Database["public"]["Enums"]["change_status"]
          target_resource_id?: string
          title?: string
          verdict?: Database["public"]["Enums"]["verdict_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "changes_new_access_resource_id_fkey"
            columns: ["new_access_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changes_target_resource_id_fkey"
            columns: ["target_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      edges: {
        Row: {
          created_at: string
          from_resource_id: string
          id: string
          org_id: string
          to_resource_id: string
        }
        Insert: {
          created_at?: string
          from_resource_id: string
          id?: string
          org_id: string
          to_resource_id: string
        }
        Update: {
          created_at?: string
          from_resource_id?: string
          id?: string
          org_id?: string
          to_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edges_from_resource_id_fkey"
            columns: ["from_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_to_resource_id_fkey"
            columns: ["to_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      hypotheses: {
        Row: {
          created_at: string
          expires_at: string
          file: string
          granted_actions: string[]
          granted_resources: string[]
          id: string
          keep_reason: string | null
          label: string | null
          last_checked_at: string | null
          org_id: string
          reduced: Json | null
          reduced_at: string | null
          reduction_pr_url: string | null
          role_arn: string
          sid: string
          status: string
          used: Json
          verdict: string | null
          window_days: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          file: string
          granted_actions?: string[]
          granted_resources?: string[]
          id: string
          keep_reason?: string | null
          label?: string | null
          last_checked_at?: string | null
          org_id: string
          reduced?: Json | null
          reduced_at?: string | null
          reduction_pr_url?: string | null
          role_arn: string
          sid: string
          status?: string
          used?: Json
          verdict?: string | null
          window_days?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          file?: string
          granted_actions?: string[]
          granted_resources?: string[]
          id?: string
          keep_reason?: string | null
          label?: string | null
          last_checked_at?: string | null
          org_id?: string
          reduced?: Json | null
          reduced_at?: string | null
          reduction_pr_url?: string | null
          role_arn?: string
          sid?: string
          status?: string
          used?: Json
          verdict?: string | null
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "hypotheses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          ingest_key: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingest_key?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          ingest_key?: string
          name?: string
        }
        Relationships: []
      }
      policy_weights: {
        Row: {
          compliance_bonus: number
          org_id: string
          scope_bonus: number
          sens_high_weight: number
          sens_low_weight: number
          sens_medium_weight: number
          threshold: number
          updated_at: string
        }
        Insert: {
          compliance_bonus?: number
          org_id: string
          scope_bonus?: number
          sens_high_weight?: number
          sens_low_weight?: number
          sens_medium_weight?: number
          threshold?: number
          updated_at?: string
        }
        Update: {
          compliance_bonus?: number
          org_id?: string
          scope_bonus?: number
          sens_high_weight?: number
          sens_low_weight?: number
          sens_medium_weight?: number
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_weights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          org_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          org_id: string
          sensitivity: Database["public"]["Enums"]["sensitivity_level"]
          tags: string[]
          type: Database["public"]["Enums"]["resource_type"]
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          org_id: string
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          tags?: string[]
          type?: Database["public"]["Enums"]["resource_type"]
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          org_id?: string
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          tags?: string[]
          type?: Database["public"]["Enums"]["resource_type"]
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      seed_demo_hypotheses: { Args: { v_org: string }; Returns: undefined }
    }
    Enums: {
      change_status: "pending" | "approved" | "blocked"
      resource_type: "service" | "role" | "database" | "storage" | "external"
      sensitivity_level: "high" | "medium" | "low"
      verdict_level: "high" | "medium" | "low"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      change_status: ["pending", "approved", "blocked"],
      resource_type: ["service", "role", "database", "storage", "external"],
      sensitivity_level: ["high", "medium", "low"],
      verdict_level: ["high", "medium", "low"],
    },
  },
} as const
```

=== src/lib/error-capture.ts ===
```
// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

// h3's HTTPError serializes to {"status":500,"unhandled":true,"message":"HTTPError"} —
// no stack, no cause — so a plain console.error(error) reaches the log pipeline with
// the failure detail stripped. Expand Error-like args into a string that keeps the
// message, stack, and the full cause chain.
const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    const status = describeStatus(current);
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

function describeStatus(error: Error): string {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? ` (status ${value})` : "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

// Wrap console.error so errors logged by any layer — including h3's internal
// unhandled-error logging, which this file cannot hook directly — are both
// recorded for consumeLastCapturedError and expanded before serialization.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const expanded = args.map((arg) => {
    if (!isErrorLike(arg)) return arg;
    record(arg);
    return describeError(arg);
  });
  originalConsoleError(...expanded);
};

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
```

=== src/lib/error-page.ts ===
```
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
```

=== src/lib/hypotheses-engine.server.ts ===
```
import type {
  AgentRun,
  Hypothesis,
  HypothesesSummary,
  HypothesisDiff,
  UsedEntry,
} from "./hypotheses-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function roleNameOf(arn: string): string {
  const parts = arn.split("/");
  return parts[parts.length - 1] || arn;
}

export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.floor((new Date(expiresAt).getTime() - now) / DAY_MS);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function parseUsed(value: unknown): UsedEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      action: typeof r["action"] === "string" ? r["action"] : "—",
      count: typeof r["count"] === "number" ? r["count"] : 0,
      resources: toStringArray(r["resources"]),
      last: typeof r["last"] === "string" ? r["last"] : null,
    };
  });
}

function buildDiff(
  grantedActions: string[],
  grantedResources: string[],
  reducedActions: string[],
  reducedResources: string[],
  hasProposal: boolean,
): HypothesisDiff {
  const actionSet = new Set(reducedActions);
  const resourceSet = new Set(reducedResources);

  const actions = [
    ...grantedActions.map((value) => ({ value, kept: hasProposal ? actionSet.has(value) : true })),
    ...reducedActions
      .filter((value) => !grantedActions.includes(value))
      .map((value) => ({ value, kept: true })),
  ];
  const resources = [
    ...grantedResources.map((value) => ({
      value,
      kept: hasProposal ? resourceSet.has(value) : true,
    })),
    ...reducedResources
      .filter((value) => !grantedResources.includes(value))
      .map((value) => ({ value, kept: true })),
  ];

  return { actions, resources, hasProposal };
}

export function mapHypothesis(row: Record<string, any>, now = Date.now()): Hypothesis {
  const reduced = (row["reduced"] ?? null) as Record<string, unknown> | null;
  const reducedActions = toStringArray(reduced?.["Action"]);
  const reducedResources = toStringArray(reduced?.["Resource"]);
  const grantedActions = toStringArray(row["granted_actions"]);
  const grantedResources = toStringArray(row["granted_resources"]);
  const hasProposal = reduced !== null;

  return {
    id: row["id"],
    sid: row["sid"],
    label: row["label"] ?? null,
    file: row["file"],
    roleArn: row["role_arn"],
    roleName: roleNameOf(row["role_arn"]),
    grantedActions,
    grantedResources,
    createdAt: row["created_at"],
    expiresAt: row["expires_at"],
    daysLeft: daysLeft(row["expires_at"], now),
    windowDays: row["window_days"],
    used: parseUsed(row["used"]),
    reducedActions,
    reducedResources,
    diff: buildDiff(grantedActions, grantedResources, reducedActions, reducedResources, hasProposal),
    verdict: row["verdict"] ?? null,
    status: row["status"],
    reductionPrUrl: row["reduction_pr_url"] ?? null,
    keepReason: row["keep_reason"] ?? null,
    lastCheckedAt: row["last_checked_at"] ?? null,
  };
}

export function summarize(rows: Record<string, any>[], now = Date.now()): HypothesesSummary {
  let active = 0;
  let expiringThisWeek = 0;
  let openPrs = 0;
  let removedLast30Days = 0;

  for (const row of rows) {
    const left = daysLeft(row["expires_at"], now);
    if (row["status"] === "active" || row["status"] === "evidence") active += 1;
    if (left >= 0 && left <= 7 && row["status"] !== "merged") expiringThisWeek += 1;
    if (row["status"] === "pr_open") openPrs += 1;
    const reducedAt = row["reduced_at"] ? new Date(row["reduced_at"]).getTime() : null;
    if (row["status"] === "merged" && reducedAt !== null && now - reducedAt <= 30 * DAY_MS) {
      removedLast30Days += 1;
    }
  }

  return { active, expiringThisWeek, openPrs, removedLast30Days };
}

export function mapAgentRun(row: Record<string, any>): AgentRun {
  const summary = row["summary"];
  return {
    id: row["id"],
    ranAt: row["ran_at"],
    summary: summary == null ? null : JSON.stringify(summary, null, 2),
  };
}
```

=== src/lib/hypotheses.functions.ts ===
```
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapAgentRun, mapHypothesis, summarize } from "./hypotheses-engine.server";
import type { AgentRun, HypothesesData } from "./hypotheses-types";

export const getHypotheses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HypothesesData> => {
    const supabase = (context as any).supabase;
    const { data, error } = await supabase
      .from("hypotheses")
      .select("*")
      .order("expires_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Record<string, any>[];
    const now = Date.now();
    return {
      hypotheses: rows.map((r) => mapHypothesis(r, now)),
      summary: summarize(rows, now),
    };
  });

export const getAgentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentRun[]> => {
    const supabase = (context as any).supabase;
    const { data, error } = await supabase
      .from("agent_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, any>[]).map(mapAgentRun);
  });

export const keepWithReason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        reason: z.string().trim().min(3).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const { data: updated, error } = await supabase
      .from("hypotheses")
      .update({ keep_reason: data.reason, status: "kept_with_reason" })
      .eq("id", data.id)
      .select("id, org_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Hypothesis not found");

    await supabase.from("audit_log").insert({
      org_id: updated.org_id,
      action: "hypothesis_kept_with_reason",
      actor_id: (context as any).userId,
      details: { hypothesis_id: data.id, reason: data.reason },
    });

    return { ok: true };
  });
```

=== src/lib/hypotheses-types.ts ===
```
export type HypothesisStatus =
  | "active"
  | "evidence"
  | "expired"
  | "pr_open"
  | "merged"
  | "kept_with_reason";

export type HypothesisVerdict = "keep" | "reduce" | "remove";

export interface UsedEntry {
  action: string;
  count: number;
  resources: string[];
  last: string | null;
}

export interface DiffLine {
  value: string;
  kept: boolean;
}

export interface HypothesisDiff {
  actions: DiffLine[];
  resources: DiffLine[];
  hasProposal: boolean;
}

export interface Hypothesis {
  id: string;
  sid: string;
  label: string | null;
  file: string;
  roleArn: string;
  roleName: string;
  grantedActions: string[];
  grantedResources: string[];
  createdAt: string;
  expiresAt: string;
  daysLeft: number;
  windowDays: number;
  used: UsedEntry[];
  reducedActions: string[];
  reducedResources: string[];
  diff: HypothesisDiff;
  verdict: HypothesisVerdict | null;
  status: HypothesisStatus;
  reductionPrUrl: string | null;
  keepReason: string | null;
  lastCheckedAt: string | null;
}

export interface HypothesesSummary {
  active: number;
  expiringThisWeek: number;
  openPrs: number;
  removedLast30Days: number;
}

export interface AgentRun {
  id: number;
  ranAt: string;
  summary: string | null;
}

export interface HypothesesData {
  hypotheses: Hypothesis[];
  summary: HypothesesSummary;
}



export function daysLeftTone(days: number): "ok" | "warn" | "bad" {
  if (days < 3) return "bad";
  if (days <= 7) return "warn";
  return "ok";
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `פג לפני ${Math.abs(days)} ימים`;
  if (days === 0) return "פג היום";
  return `נותרו ${days} ימים`;
}
```

=== src/lib/i18n.tsx ===
```
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "he";

const STORAGE_KEY = "radius-lang";

type Params = Record<string, string | number>;

const EN: Record<string, string> = {
  "nav.changes": "Pending changes",
  "nav.hypotheses": "Hypotheses",
  "nav.map": "Dependency map",
  "nav.policy": "Policy",
  "nav.runs": "Agent runs",
  "nav.lang": "עברית",
  "nav.langTitle": "Switch to Hebrew",

  "common.loading": "Loading…",
  "common.none": "—",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.noValues": "No values",

  "landing.title": "Know what will change — before it reaches production",
  "landing.sub":
    "Radius analyzes every planned cloud infrastructure change — IAM permissions, configuration and service-to-service access — and shows which services are impacted, which permissions get exposed, and what the risk score is, with every point explained.",
  "landing.cta": "Enter the console",

  "changes.loading": "Loading data…",
  "changes.loadError": "Failed to load data",
  "changes.title": "Changes ({count})",
  "changes.new": "+ New change",
  "changes.empty": "No changes yet.",
  "changes.score": "score {score}",
  "changes.pick": "Select a change from the list to see its risk analysis.",
  "changes.approved": "Change approved",
  "changes.blocked": "Change blocked",
  "changes.actionFailed": "Action failed",
  "changes.simulationSaved": "Simulation ran and was saved",
  "changes.createFailed": "Could not create the change",

  "status.pending": "Pending",
  "status.approved": "Approved",
  "status.blocked": "Blocked",

  "verdict.high": "High risk — approval required",
  "verdict.medium": "Medium risk — review recommended",
  "verdict.low": "Low risk — auto-approved",

  "sensitivity.high": "High sensitivity",
  "sensitivity.medium": "Medium sensitivity",
  "sensitivity.low": "Low sensitivity",

  "detail.target": "target: {name}",
  "detail.scope": " · scope broadened to wildcard",
  "detail.blast": "Blast radius simulation",
  "detail.impacted": "Impacted resources and services ({count})",
  "detail.newAccessReason": "New access created directly by this change",
  "detail.newResource": "New resource",
  "detail.noDependents":
    "No services depend on this resource — the impact is limited to the resource itself.",
  "detail.dependsOn": "Depends on {name} · {hops} in the map",
  "detail.hop": "1 hop",
  "detail.hops": "{n} hops",
  "detail.riskScore": "Risk score",
  "detail.outOf": "out of 100 · approval threshold: {threshold}",
  "detail.breakdown": "Score breakdown",
  "detail.approve": "Approve change",
  "detail.block": "Block change",
  "detail.decidedApproved": "Approved on {date}",
  "detail.decidedBlocked": "Blocked on {date}",

  "bd.base": "Baseline change in the production environment",
  "bd.targetHigh": "Target resource is classified as high sensitivity",
  "bd.dependents": "{count} services depend on the changed resource",
  "bd.wildcard": "Permission scope broadened to a wildcard",
  "bd.sensitiveAccess": "New access to a sensitive resource ({name})",

  "modal.title": "Run a custom simulation",
  "modal.name": "Change name",
  "modal.namePlaceholder": "For example: grant write access to reporting-service",
  "modal.target": "Target resource",
  "modal.newAccess": "Grant new access to resource",
  "modal.newAccessNone": "None",
  "modal.scope": "Broaden the permission scope to a wildcard (e.g. s3:* instead of one action)",
  "modal.run": "Run simulation",

  "map.title": "Full dependency map",
  "map.loading": "Loading map…",
  "map.legendRole": "Permission / role",
  "map.legendService": "Service",
  "map.legendData": "Database / storage",
  "map.legendExternal": "External",

  "walk.title": "Example: what happens when this change ships",
  "walk.play": "Play example",
  "walk.pause": "Pause",
  "walk.replay": "Replay",
  "walk.next": "Next step",
  "walk.step": "Step {n} of {total}",
  "walk.s0.title": "A developer opens a pull request",
  "walk.s0.body":
    "The change broadens the {target} permission to a wildcard and grants it access to {access}. On its own it looks like a one-line diff.",
  "walk.s1.title": "Radius locates the resource on the dependency map",
  "walk.s1.body":
    "{target} is highlighted. Everything connected to it is now a candidate for impact.",
  "walk.s2.title": "First hop: direct consumers",
  "walk.s2.body": "{count} services call {target} directly and inherit the new permission instantly.",
  "walk.s3.title": "Second and third hop: indirect reach",
  "walk.s3.body":
    "{count} more services reach it through another service. This is the part a code review never shows.",
  "walk.s4.title": "The verdict",
  "walk.s4.body":
    "Total blast radius: {count} resources, including data with PII. Risk score {score} out of 100 — above the approval threshold, so the change is held for review.",
  "walk.noData": "The example needs a dependency map with connected services.",
  "walk.hint": "This runs on the real map above, using the same engine as every change.",

  "policy.loading": "Loading policy…",
  "policy.title": "Risk engine policy",
  "policy.intro":
    "These weights apply to every change in the organization. Changing them recalculates all scores in real time.",
  "policy.save": "Save policy",
  "policy.reset": "Reset",
  "policy.saved": "Policy saved and all scores recalculated",
  "policy.saveFailed": "Could not save the policy",
  "policy.threshold": "Manual approval threshold",
  "policy.thresholdHint": "Above this score a change is flagged as requiring approval",
  "policy.sensHigh": "Weight of a high-sensitivity resource",
  "policy.sensHighHint": "Points added when the target resource is high sensitivity",
  "policy.sensMedium": "Weight of a medium-sensitivity resource",
  "policy.sensMediumHint": "Points added when the target resource is medium sensitivity",
  "policy.sensLow": "Weight of a low-sensitivity resource",
  "policy.sensLowHint": "Points added when the target resource is low sensitivity",
  "policy.scopeBonus": "Wildcard scope penalty",
  "policy.scopeBonusHint": "Points added for a blanket permission",
  "policy.complianceBonus": "PII / compliance exposure penalty",
  "policy.complianceBonusHint": "Points added for access to a resource tagged pii or compliance",

  "hyp.loading": "Loading hypotheses…",
  "hyp.loadError": "Failed to load hypotheses.",
  "hyp.statActive": "Active hypotheses",
  "hyp.statExpiring": "Expiring this week",
  "hyp.statPrs": "Open reduction PRs",
  "hyp.statRemoved": "Permissions reduced in 30 days",
  "hyp.title": "Hypotheses",
  "hyp.sorted": "sorted by expiry",
  "hyp.empty": "No hypotheses yet. The agent will write here on its next run.",
  "hyp.pick": "Select a hypothesis to see the evidence and the proposal.",
  "hyp.saved": "Justification saved and the hypothesis was marked as kept",
  "hyp.saveFailed": "Could not save the justification",
  "hyp.window": "{days}-day window · last checked {date}",
  "hyp.diffTitle": "Granted vs. proposed",
  "hyp.diffNote": "{verdict} — red lines disappear, green lines stay.",
  "hyp.diffPending":
    "The agent is still collecting evidence. Until the window closes, only what was granted is shown.",
  "hyp.prLink": "Open reduction PR",
  "hyp.observed": "What was actually observed",
  "hyp.observedEmpty": "No call was observed during the evidence window.",
  "hyp.thAction": "Action",
  "hyp.thCount": "Calls",
  "hyp.thResources": "Resources",
  "hyp.thLast": "Last seen",
  "hyp.granted": "What was originally granted",
  "hyp.file": "File",
  "hyp.keepTitle": "Keep with justification",
  "hyp.keepSaved": "Saved justification:",
  "hyp.keepPlaceholder": "Why does this permission have to stay as it is?",
  "hyp.keepSaving": "Saving…",
  "hyp.keepAction": "Keep with justification",

  "hypStatus.active": "Active",
  "hypStatus.evidence": "Collecting evidence",
  "hypStatus.expired": "Expired",
  "hypStatus.pr_open": "PR open",
  "hypStatus.merged": "Merged",
  "hypStatus.kept_with_reason": "Kept with justification",

  "hypVerdict.keep": "Keep as is",
  "hypVerdict.reduce": "Reduce to what was observed",
  "hypVerdict.remove": "Remove — never used",
  "hypVerdict.proposal": "Reduction proposal from the agent",

  "days.expiredAgo": "expired {n} days ago",
  "days.today": "expires today",
  "days.left": "{n} days left",

  "runs.loading": "Loading runs…",
  "runs.loadError": "Failed to load the runs.",
  "runs.title": "Agent runs",
  "runs.last": "last 50",
  "runs.empty": "The agent has not run yet.",
};

const HE: Record<string, string> = {
  "nav.changes": "שינויים ממתינים",
  "nav.hypotheses": "היפותזות",
  "nav.map": "מפת תלויות",
  "nav.policy": "מדיניות",
  "nav.runs": "ריצות סוכן",
  "nav.lang": "English",
  "nav.langTitle": "מעבר לאנגלית",

  "common.loading": "טוען…",
  "common.none": "—",
  "common.save": "שמור",
  "common.cancel": "ביטול",
  "common.noValues": "אין ערכים",

  "landing.title": "לדעת מה ישתנה — לפני שזה מגיע לפרודקשן",
  "landing.sub":
    "Radius מנתח כל שינוי מתוכנן בתשתית הענן — הרשאות IAM, קונפיגורציה וחיבורים בין שירותים — ומראה אילו שירותים מושפעים, אילו הרשאות נחשפות ומה ציון הסיכון, כשכל נקודה בציון מוסברת.",
  "landing.cta": "כניסה לקונסולה",

  "changes.loading": "טוען נתונים…",
  "changes.loadError": "שגיאה בטעינת הנתונים",
  "changes.title": "שינויים ({count})",
  "changes.new": "+ שינוי חדש",
  "changes.empty": "אין שינויים עדיין.",
  "changes.score": "ציון {score}",
  "changes.pick": "בחר שינוי מהרשימה כדי לראות את ניתוח הסיכון.",
  "changes.approved": "השינוי אושר",
  "changes.blocked": "השינוי נחסם",
  "changes.actionFailed": "הפעולה נכשלה",
  "changes.simulationSaved": "הסימולציה הורצה ונשמרה",
  "changes.createFailed": "יצירת השינוי נכשלה",

  "status.pending": "ממתין",
  "status.approved": "אושר",
  "status.blocked": "נחסם",

  "verdict.high": "סיכון גבוה — נדרש אישור",
  "verdict.medium": "סיכון בינוני — מומלץ לבדוק",
  "verdict.low": "סיכון נמוך — אושר אוטומטית",

  "sensitivity.high": "רגישות גבוהה",
  "sensitivity.medium": "רגישות בינונית",
  "sensitivity.low": "רגישות נמוכה",

  "detail.target": "יעד: {name}",
  "detail.scope": " · הרחבת היקף ל-wildcard",
  "detail.blast": "סימולציית תפוצה (blast radius)",
  "detail.impacted": "משאבים ושירותים מושפעים ({count})",
  "detail.newAccessReason": "גישה חדשה שנוצרת ישירות על ידי השינוי",
  "detail.newResource": "משאב חדש",
  "detail.noDependents": "אין שירותים תלויים במשאב הזה — ההשפעה מוגבלת למשאב עצמו.",
  "detail.dependsOn": "תלוי ב-{name} · {hops} במפה",
  "detail.hop": "קפיצה אחת",
  "detail.hops": "{n} קפיצות",
  "detail.riskScore": "ציון סיכון",
  "detail.outOf": "מתוך 100 · סף אישור: {threshold}",
  "detail.breakdown": "פירוט חישוב",
  "detail.approve": "אשר שינוי",
  "detail.block": "חסום שינוי",
  "detail.decidedApproved": "אושר ב-{date}",
  "detail.decidedBlocked": "נחסם ב-{date}",

  "bd.base": "שינוי בסיסי בסביבת production",
  "bd.targetHigh": "משאב היעד מסווג ברגישות גבוהה",
  "bd.dependents": "{count} שירותים תלויים במשאב שהשתנה",
  "bd.wildcard": "הרחבת היקף הרשאה ל-wildcard",
  "bd.sensitiveAccess": "גישה חדשה למשאב רגיש ({name})",

  "modal.title": "הרצת סימולציה מותאמת",
  "modal.name": "שם השינוי",
  "modal.namePlaceholder": "לדוגמה: הוספת הרשאת כתיבה ל-reporting-service",
  "modal.target": "משאב היעד",
  "modal.newAccess": "הענקת גישה חדשה למשאב",
  "modal.newAccessNone": "ללא",
  "modal.scope": "הרחבת היקף ההרשאה ל-wildcard (למשל s3:* במקום פעולה ספציפית)",
  "modal.run": "הרץ סימולציה",

  "map.title": "מפת התלויות המלאה",
  "map.loading": "טוען מפה…",
  "map.legendRole": "הרשאה / role",
  "map.legendService": "שירות",
  "map.legendData": "מאגר נתונים / אחסון",
  "map.legendExternal": "חיצוני",

  "walk.title": "דוגמה: מה קורה כששינוי כזה יוצא לדרך",
  "walk.play": "הרץ דוגמה",
  "walk.pause": "השהה",
  "walk.replay": "הרץ שוב",
  "walk.next": "השלב הבא",
  "walk.step": "שלב {n} מתוך {total}",
  "walk.s0.title": "מפתח פותח pull request",
  "walk.s0.body":
    "השינוי מרחיב את ההרשאה של {target} ל-wildcard ומעניק לה גישה ל-{access}. בפני עצמו זה נראה כמו שורה אחת ב-diff.",
  "walk.s1.title": "Radius מאתר את המשאב במפת התלויות",
  "walk.s1.body": "{target} מסומן. כל מה שמחובר אליו הוא כעת מועמד להשפעה.",
  "walk.s2.title": "קפיצה ראשונה: צרכנים ישירים",
  "walk.s2.body": "{count} שירותים פונים ל-{target} ישירות ויורשים את ההרשאה החדשה מיידית.",
  "walk.s3.title": "קפיצה שנייה ושלישית: השפעה עקיפה",
  "walk.s3.body":
    "עוד {count} שירותים מגיעים אליו דרך שירות אחר. את זה code review לא מראה אף פעם.",
  "walk.s4.title": "ההכרעה",
  "walk.s4.body":
    "סך התפוצה: {count} משאבים, כולל נתונים עם PII. ציון סיכון {score} מתוך 100 — מעל סף האישור, ולכן השינוי נעצר לבדיקה.",
  "walk.noData": "כדי להריץ את הדוגמה נדרשת מפת תלויות עם שירותים מחוברים.",
  "walk.hint": "הדוגמה רצה על המפה האמיתית שלמעלה, עם אותו מנוע שמנתח כל שינוי.",

  "policy.loading": "טוען מדיניות…",
  "policy.title": "מדיניות מנוע הסיכון",
  "policy.intro": "המשקלים חלים על כל השינויים בארגון. שינוי כאן מחשב מחדש את הציונים בזמן אמת.",
  "policy.save": "שמור מדיניות",
  "policy.reset": "שחזור",
  "policy.saved": "המדיניות נשמרה וכל הציונים חושבו מחדש",
  "policy.saveFailed": "שמירת המדיניות נכשלה",
  "policy.threshold": "סף לאישור ידני",
  "policy.thresholdHint": "מעל הציון הזה השינוי מסומן כדורש אישור",
  "policy.sensHigh": "משקל משאב ברגישות גבוהה",
  "policy.sensHighHint": "כמה נקודות מתווספות כשמשאב היעד ברגישות גבוהה",
  "policy.sensMedium": "משקל משאב ברגישות בינונית",
  "policy.sensMediumHint": "כמה נקודות מתווספות כשמשאב היעד ברגישות בינונית",
  "policy.sensLow": "משקל משאב ברגישות נמוכה",
  "policy.sensLowHint": "כמה נקודות מתווספות כשמשאב היעד ברגישות נמוכה",
  "policy.scopeBonus": "קנס הרחבת היקף ל-wildcard",
  "policy.scopeBonusHint": "כמה נקודות מתווספות על הרשאה גורפת",
  "policy.complianceBonus": "קנס חשיפת PII / ציות",
  "policy.complianceBonusHint": "כמה נקודות מתווספות על גישה למשאב עם תגית pii או compliance",

  "hyp.loading": "טוען היפותזות…",
  "hyp.loadError": "שגיאה בטעינת ההיפותזות.",
  "hyp.statActive": "היפותזות פעילות",
  "hyp.statExpiring": "פגות תוקף השבוע",
  "hyp.statPrs": "PRs פתוחים לצמצום",
  "hyp.statRemoved": "הרשאות שצומצמו ב-30 יום",
  "hyp.title": "היפותזות",
  "hyp.sorted": "ממוין לפי תפוגה",
  "hyp.empty": "אין עדיין היפותזות. הסוכן יכתוב לכאן בריצה הבאה.",
  "hyp.pick": "בחר היפותזה כדי לראות את הראיות וההצעה.",
  "hyp.saved": "ההצדקה נשמרה וההיפותזה סומנה כנשמרה",
  "hyp.saveFailed": "שמירת ההצדקה נכשלה",
  "hyp.window": "חלון {days} ימים · נבדק לאחרונה {date}",
  "hyp.diffTitle": "מה הוענק מול מה מוצע",
  "hyp.diffNote": "{verdict} — שורות אדומות נעלמות, ירוקות נשארות.",
  "hyp.diffPending": "הסוכן עדיין אוסף ראיות. עד לסיום החלון מוצג מה שהוענק בפועל.",
  "hyp.prLink": "פתח PR לצמצום",
  "hyp.observed": "מה נצפה בפועל",
  "hyp.observedEmpty": "לא נצפתה אף קריאה בחלון התצפית.",
  "hyp.thAction": "פעולה",
  "hyp.thCount": "קריאות",
  "hyp.thResources": "משאבים",
  "hyp.thLast": "נצפה לאחרונה",
  "hyp.granted": "מה הוענק במקור",
  "hyp.file": "קובץ",
  "hyp.keepTitle": "השאר עם הצדקה",
  "hyp.keepSaved": "ההצדקה שנשמרה:",
  "hyp.keepPlaceholder": "למה ההרשאה הזו חייבת להישאר כפי שהיא?",
  "hyp.keepSaving": "שומר…",
  "hyp.keepAction": "השאר עם הצדקה",

  "hypStatus.active": "פעילה",
  "hypStatus.evidence": "אוספת ראיות",
  "hypStatus.expired": "פגה תוקף",
  "hypStatus.pr_open": "PR פתוח",
  "hypStatus.merged": "מוזג",
  "hypStatus.kept_with_reason": "נשמרה עם הצדקה",

  "hypVerdict.keep": "להשאיר כפי שהוא",
  "hypVerdict.reduce": "לצמצם למה שנצפה",
  "hypVerdict.remove": "להסיר — לא היה שימוש",
  "hypVerdict.proposal": "הצעת צמצום מהסוכן",

  "days.expiredAgo": "פג לפני {n} ימים",
  "days.today": "פג היום",
  "days.left": "נותרו {n} ימים",

  "runs.loading": "טוען ריצות…",
  "runs.loadError": "שגיאה בטעינת הריצות.",
  "runs.title": "ריצות סוכן",
  "runs.last": "50 האחרונות",
  "runs.empty": "הסוכן עדיין לא רץ.",
};

const DICTS: Record<Lang, Record<string, string>> = { en: EN, he: HE };

function interpolate(template: string, params?: Params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    params[k] === undefined ? m : String(params[k]),
  );
}

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  locale: string;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "he" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      dir: lang === "he" ? "rtl" : "ltr",
      locale: lang === "he" ? "he-IL" : "en-US",
      setLang,
      toggleLang: () => setLang(lang === "he" ? "en" : "he"),
      t: (key, params) => interpolate(dict[key] ?? EN[key] ?? key, params),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    lang: "en",
    dir: "ltr",
    locale: "en-US",
    setLang: () => {},
    toggleLang: () => {},
    t: (key, params) => interpolate(EN[key] ?? key, params),
  };
}

export function daysLeftKey(days: number): { key: string; params: Params } {
  if (days < 0) return { key: "days.expiredAgo", params: { n: Math.abs(days) } };
  if (days === 0) return { key: "days.today", params: {} };
  return { key: "days.left", params: { n: days } };
}
```

=== src/lib/lovable-error-reporting.ts ===
```
type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to lovable.js's reporting hook,
  // which is present only inside the editor preview.
  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  window.__lovableReportRuntimeError?.({
    message,
    ...(stack !== undefined && { stack }),
    filename: window.location.pathname,
  });
}
```

=== src/lib/radius-engine.server.ts ===
```
import type {
  BreakdownItem,
  ConsumerHit,
  PolicyWeights,
  RadiusEdge,
  RadiusResource,
  SimulationResult,
  Verdict,
} from "./radius-types";

/**
 * Ported 1:1 from the Radius prototype engine (bfsConsumers + simulate).
 * Runs on the server only, so scores cannot be manipulated from the browser.
 */
export function bfsConsumers(
  targetId: string,
  edges: RadiusEdge[],
  maxHops: number,
): ConsumerHit[] {
  const visited = new Set<string>([targetId]);
  let frontier: string[] = [targetId];
  const found: ConsumerHit[] = [];

  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    edges.forEach(({ from, to }) => {
      if (frontier.includes(to) && !visited.has(from)) {
        visited.add(from);
        next.push(from);
        found.push({ id: from, hop });
      }
    });
    if (next.length === 0) break;
    frontier = next;
  }
  return found;
}

export interface SimulateInput {
  targetId: string;
  newAccessId: string | null;
  scopeBroadened: boolean;
}

const HOP_WEIGHT: Record<number, number> = { 1: 1, 2: 0.6, 3: 0.35 };

export function simulate(
  change: SimulateInput,
  resources: RadiusResource[],
  edges: RadiusEdge[],
  weights: PolicyWeights,
): SimulationResult {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const effectiveEdges = edges.slice();
  if (change.newAccessId) {
    effectiveEdges.push({ from: change.targetId, to: change.newAccessId });
  }

  const consumers = bfsConsumers(change.targetId, effectiveEdges, 3);
  const targetNode = byId.get(change.targetId);
  const newResourceNode = change.newAccessId ? (byId.get(change.newAccessId) ?? null) : null;

  const breakdown: BreakdownItem[] = [];
  let score = 15;
  breakdown.push({
    label: "Baseline change in the production environment",
    points: 15,
    key: "bd.base",
  });

  if (targetNode?.sensitivity === "high") {
    score += 8;
    breakdown.push({
      label: "Target resource is classified as high sensitivity",
      points: 8,
      key: "bd.targetHigh",
    });
  }

  let consumerPts = 0;
  consumers.forEach((c) => {
    const n = byId.get(c.id);
    if (!n) return;
    const w =
      n.sensitivity === "high"
        ? weights.sensHigh
        : n.sensitivity === "medium"
          ? weights.sensMedium
          : weights.sensLow;
    consumerPts += w * (HOP_WEIGHT[c.hop] ?? 0);
  });
  if (consumerPts > 0) {
    consumerPts = Math.round(consumerPts);
    score += consumerPts;
    breakdown.push({
      label: `${consumers.length} services depend on the changed resource`,
      points: consumerPts,
      key: "bd.dependents",
      params: { count: consumers.length },
    });
  }

  if (change.scopeBroadened) {
    score += weights.scopeBonus;
    breakdown.push({
      label: "Permission scope broadened to a wildcard",
      points: weights.scopeBonus,
      key: "bd.wildcard",
    });
  }

  if (
    newResourceNode &&
    (newResourceNode.tags.includes("pii") || newResourceNode.tags.includes("compliance"))
  ) {
    score += weights.complianceBonus;
    breakdown.push({
      label: `New access to a sensitive resource (${newResourceNode.name})`,
      points: weights.complianceBonus,
      key: "bd.sensitiveAccess",
      params: { name: newResourceNode.name },
    });
  }


  score = Math.min(100, Math.round(score));
  const verdict: Verdict =
    score >= weights.threshold
      ? "high"
      : score >= Math.round(weights.threshold * 0.55)
        ? "medium"
        : "low";

  return {
    targetId: change.targetId,
    newResourceId: change.newAccessId,
    consumers,
    score,
    verdict,
    breakdown,
  };
}

export function normalizeWeights(row: {
  threshold: number;
  sens_high_weight: number;
  sens_medium_weight: number;
  sens_low_weight: number;
  scope_bonus: number;
  compliance_bonus: number;
}): PolicyWeights {
  return {
    threshold: row.threshold,
    sensHigh: row.sens_high_weight,
    sensMedium: row.sens_medium_weight,
    sensLow: row.sens_low_weight,
    scopeBonus: row.scope_bonus,
    complianceBonus: row.compliance_bonus,
  };
}

export function clampWeights(w: PolicyWeights): PolicyWeights {
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number.isFinite(v) ? v : min)));
  return {
    threshold: clamp(w.threshold, 30, 95),
    sensHigh: clamp(w.sensHigh, 4, 30),
    sensMedium: clamp(w.sensMedium, 1, 30),
    sensLow: clamp(w.sensLow, 0, 30),
    scopeBonus: clamp(w.scopeBonus, 0, 40),
    complianceBonus: clamp(w.complianceBonus, 0, 40),
  };
}
```

=== src/lib/radius.functions.ts ===
```
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  clampWeights,
  normalizeWeights,
  simulate,
  type SimulateInput,
} from "./radius-engine.server";
import type {
  ConsoleData,
  PolicyWeights,
  RadiusChange,
  RadiusEdge,
  RadiusResource,
  SimulationResult,
} from "./radius-types";

type Ctx = { supabase: any; userId: string };

async function loadGraph(supabase: any) {
  const [{ data: resources, error: rErr }, { data: edges, error: eErr }, { data: weights }] =
    await Promise.all([
      supabase.from("resources").select("*").order("key"),
      supabase.from("edges").select("*"),
      supabase.from("policy_weights").select("*").maybeSingle(),
    ]);
  if (rErr) throw new Error(rErr.message);
  if (eErr) throw new Error(eErr.message);

  const mappedResources: RadiusResource[] = (resources ?? []).map((r: any) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    type: r.type,
    sensitivity: r.sensitivity,
    tags: r.tags ?? [],
    x: r.x,
    y: r.y,
  }));
  const mappedEdges: RadiusEdge[] = (edges ?? []).map((e: any) => ({
    from: e.from_resource_id,
    to: e.to_resource_id,
  }));
  const mappedWeights: PolicyWeights = weights
    ? normalizeWeights(weights)
    : {
        threshold: 70,
        sensHigh: 14,
        sensMedium: 7,
        sensLow: 3,
        scopeBonus: 22,
        complianceBonus: 20,
      };

  return { resources: mappedResources, edges: mappedEdges, weights: mappedWeights };
}

function toChange(
  row: any,
  resources: RadiusResource[],
  edges: RadiusEdge[],
  weights: PolicyWeights,
): RadiusChange {
  const input: SimulateInput = {
    targetId: row.target_resource_id,
    newAccessId: row.new_access_resource_id,
    scopeBroadened: row.scope_broadened,
  };
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    targetResourceId: row.target_resource_id,
    newAccessResourceId: row.new_access_resource_id,
    scopeBroadened: row.scope_broadened,
    status: row.status,
    source: row.source,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    simulation: simulate(input, resources, edges, weights),
  };
}

export const getConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsoleData> => {
    const { supabase } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);

    const [{ data: changes, error }, { data: org }] = await Promise.all([
      supabase.from("changes").select("*").order("created_at", { ascending: false }),
      supabase.from("organizations").select("name, ingest_key").maybeSingle(),
    ]);
    if (error) throw new Error(error.message);

    return {
      orgName: org?.name ?? "radius",
      ingestKey: org?.ingest_key ?? "",
      resources,
      edges,
      weights,
      changes: (changes ?? []).map((c: any) => toChange(c, resources, edges, weights)),
    };
  });

export const createChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().max(160).optional(),
        targetResourceId: z.string().uuid(),
        newAccessResourceId: z.string().uuid().nullable().optional(),
        scopeBroadened: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);

    const result = simulate(
      {
        targetId: data.targetResourceId,
        newAccessId: data.newAccessResourceId ?? null,
        scopeBroadened: data.scopeBroadened,
      },
      resources,
      edges,
      weights,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, org_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("changes")
      .insert({
        org_id: profile?.org_id,
        title: data.title?.trim() || "Untitled custom change",
        author: profile?.display_name || "you",
        target_resource_id: data.targetResourceId,
        new_access_resource_id: data.newAccessResourceId ?? null,
        scope_broadened: data.scopeBroadened,
        score: result.score,
        verdict: result.verdict,
        breakdown: result.breakdown,
        source: "manual",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      org_id: profile?.org_id,
      change_id: inserted.id,
      action: "created",
      actor_id: userId,
      actor_name: profile?.display_name ?? null,
      details: { score: result.score, verdict: result.verdict },
    });

    return { id: inserted.id };
  });

export const decideChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        changeId: z.string().uuid(),
        decision: z.enum(["approved", "blocked", "pending"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as Ctx;
    const { resources, edges, weights } = await loadGraph(supabase);

    const { data: row, error: readErr } = await supabase
      .from("changes")
      .select("*")
      .eq("id", data.changeId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const result = simulate(
      {
        targetId: row.target_resource_id,
        newAccessId: row.new_access_resource_id,
        scopeBroadened: row.scope_broadened,
      },
      resources,
      edges,
      weights,
    );

    const { error } = await supabase
      .from("changes")
      .update({
        status: data.decision,
        score: result.score,
        verdict: result.verdict,
        breakdown: result.breakdown,
        decided_by: data.decision === "pending" ? null : userId,
        decided_at: data.decision === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", data.changeId);
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, org_id")
      .eq("id", userId)
      .maybeSingle();

    await supabase.from("audit_log").insert({
      org_id: profile?.org_id ?? row.org_id,
      change_id: data.changeId,
      action: data.decision,
      actor_id: userId,
      actor_name: profile?.display_name ?? null,
      details: { score: result.score, verdict: result.verdict },
    });

    return { ok: true };
  });

export const saveWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threshold: z.number(),
        sensHigh: z.number(),
        sensMedium: z.number(),
        sensLow: z.number(),
        scopeBonus: z.number(),
        complianceBonus: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PolicyWeights> => {
    const { supabase, userId } = context as unknown as Ctx;
    const w = clampWeights(data);

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("policy_weights").upsert({
      org_id: profile?.org_id,
      threshold: w.threshold,
      sens_high_weight: w.sensHigh,
      sens_medium_weight: w.sensMedium,
      sens_low_weight: w.sensLow,
      scope_bonus: w.scopeBonus,
      compliance_bonus: w.complianceBonus,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return w;
  });

export const previewPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        changeId: z.string().uuid(),
        weights: z.object({
          threshold: z.number(),
          sensHigh: z.number(),
          sensMedium: z.number(),
          sensLow: z.number(),
          scopeBonus: z.number(),
          complianceBonus: z.number(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { supabase } = context as unknown as Ctx;
    const { resources, edges } = await loadGraph(supabase);
    const { data: row, error } = await supabase
      .from("changes")
      .select("target_resource_id, new_access_resource_id, scope_broadened")
      .eq("id", data.changeId)
      .single();
    if (error) throw new Error(error.message);

    return simulate(
      {
        targetId: row.target_resource_id,
        newAccessId: row.new_access_resource_id,
        scopeBroadened: row.scope_broadened,
      },
      resources,
      edges,
      clampWeights(data.weights),
    );
  });
```

=== src/lib/radius-types.ts ===
```
export type ResourceType = "service" | "role" | "database" | "storage" | "external";
export type Sensitivity = "high" | "medium" | "low";
export type ChangeStatus = "pending" | "approved" | "blocked";
export type Verdict = "high" | "medium" | "low";

export interface RadiusResource {
  id: string;
  key: string;
  name: string;
  type: ResourceType;
  sensitivity: Sensitivity;
  tags: string[];
  x: number;
  y: number;
}

export interface RadiusEdge {
  from: string;
  to: string;
}

export interface PolicyWeights {
  threshold: number;
  sensHigh: number;
  sensMedium: number;
  sensLow: number;
  scopeBonus: number;
  complianceBonus: number;
}

export interface BreakdownItem {
  label: string;
  points: number;
  key?: string;
  params?: Record<string, string | number>;
}


export interface ConsumerHit {
  id: string;
  hop: number;
}

export interface SimulationResult {
  targetId: string;
  newResourceId: string | null;
  consumers: ConsumerHit[];
  score: number;
  verdict: Verdict;
  breakdown: BreakdownItem[];
}

export interface RadiusChange {
  id: string;
  title: string;
  author: string;
  targetResourceId: string;
  newAccessResourceId: string | null;
  scopeBroadened: boolean;
  status: ChangeStatus;
  source: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  simulation: SimulationResult;
}

export interface ConsoleData {
  orgName: string;
  ingestKey: string;
  resources: RadiusResource[];
  edges: RadiusEdge[];
  weights: PolicyWeights;
  changes: RadiusChange[];
}

export const TYPE_COLOR: Record<ResourceType, string> = {
  role: "#FF7A45",
  service: "#4C86FF",
  database: "#B26BFF",
  storage: "#B26BFF",
  external: "#5B6672",
};



```

=== src/lib/utils.ts ===
```
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

=== src/radius.css ===
```
/* Radius design language — ported from the product prototype. */
:root {
  --ink: #0b0f14;
  --panel: #121820;
  --panel-2: #171e27;
  --panel-3: #1d2530;
  --hairline: #242d38;
  --fg: #edeff2;
  --fg-muted: #8d98a3;
  --fg-faint: #5b6672;
  --signal: #ff7a45;
  --signal-soft: rgba(255, 122, 69, 0.14);
  --confirm: #34d399;
  --confirm-soft: rgba(52, 211, 153, 0.14);
  --warn: #f5c242;
  --warn-soft: rgba(245, 194, 66, 0.14);
  --danger: #ff5a5a;
}

html,
body {
  background: var(--ink);
  color: var(--fg);
}

body {
  font-family: "Heebo", sans-serif;
  font-size: 15px;
  line-height: 1.55;
}

.r-display,
.r-app h1,
.r-app h2,
.r-app h3,
.r-app h4 {
  font-family: "Rubik", sans-serif;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.r-app button,
.r-app select,
.r-app input {
  font-family: "Heebo", sans-serif;
}

/* ---- top bar ---- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 26px;
  border-bottom: 1px solid var(--hairline);
  background: var(--panel);
  flex-wrap: wrap;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Rubik", sans-serif;
  font-weight: 800;
  font-size: 18px;
}
.logo svg {
  width: 20px;
  height: 20px;
}
.tabs {
  display: flex;
  gap: 6px;
  background: var(--panel-2);
  padding: 4px;
  border-radius: 8px;
}
.tab-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.tab-btn.active {
  background: var(--panel-3);
  color: var(--fg);
}
.tab-btn:hover:not(.active) {
  color: var(--fg);
}
.env-tag {
  font-size: 12px;
  color: var(--fg-faint);
  border: 1px solid var(--hairline);
  padding: 5px 10px;
  border-radius: 20px;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.link-btn {
  background: transparent;
  border: none;
  color: var(--fg-muted);
  font-size: 12.5px;
  cursor: pointer;
}
.link-btn:hover {
  color: var(--fg);
}

.app-shell {
  padding: 26px;
  max-width: 1320px;
  margin: 0 auto;
}

.dash-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 960px) {
  .dash-grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: 10px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--hairline);
}
.panel-head h3 {
  font-size: 14px;
  color: var(--fg-muted);
  font-weight: 600;
}
.new-btn {
  background: var(--signal);
  color: #1a0e08;
  border: none;
  font-weight: 700;
  font-size: 13px;
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.new-btn:hover {
  background: #ff8c60;
}

.change-item {
  padding: 14px 18px;
  border-bottom: 1px solid var(--hairline);
  cursor: pointer;
  width: 100%;
  text-align: start;
  background: transparent;
  border-inline: none;
  border-top: none;
  display: block;
}
.change-item:last-child {
  border-bottom: none;
}
.change-item:hover {
  background: var(--panel-2);
}
.change-item.selected {
  background: var(--panel-2);
  border-inline-end: 3px solid var(--signal);
}
.change-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--fg);
}
.change-meta {
  font-size: 12px;
  color: var(--fg-faint);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.status-chip {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}
.status-pending {
  background: var(--panel-3);
  color: var(--fg-muted);
}
.status-approved {
  background: var(--confirm-soft);
  color: var(--confirm);
}
.status-blocked {
  background: rgba(255, 90, 90, 0.14);
  color: var(--danger);
}

.detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--hairline);
}
.detail-title {
  font-size: 16px;
  font-weight: 700;
}
.detail-sub {
  font-size: 12.5px;
  color: var(--fg-faint);
  margin-top: 3px;
}
.verdict-pill {
  font-size: 12.5px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 20px;
  white-space: nowrap;
}
.verdict-high {
  background: var(--signal-soft);
  color: var(--signal);
}
.verdict-medium {
  background: var(--warn-soft);
  color: var(--warn);
}
.verdict-low {
  background: var(--confirm-soft);
  color: var(--confirm);
}

.detail-body {
  padding: 22px;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 20px;
}
@media (max-width: 1100px) {
  .detail-body {
    grid-template-columns: 1fr;
  }
}

.subcard {
  background: var(--panel-2);
  border: 1px solid var(--hairline);
  border-radius: 8px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.subcard h4 {
  font-size: 12.5px;
  color: var(--fg-muted);
  font-weight: 600;
  margin-bottom: 12px;
}

svg.graph {
  width: 100%;
  height: auto;
  display: block;
}
.gnode-label {
  font-family: "Heebo", sans-serif;
  font-size: 10.5px;
  fill: var(--fg-muted);
}
.gnode-label.hi {
  fill: var(--fg);
  font-weight: 600;
}
.gedge {
  stroke: var(--hairline);
  stroke-width: 1;
}
.gedge.hit {
  stroke: var(--signal);
  stroke-width: 1.4;
}
.gedge.newedge {
  stroke: var(--danger);
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}

.gauge-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 2px;
}
.gauge-score {
  font-family: "Rubik", sans-serif;
  font-size: 36px;
  font-weight: 800;
  margin-top: -56px;
}
.gauge-verdict-label {
  font-size: 12px;
  color: var(--fg-muted);
  margin-top: 4px;
  text-align: center;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  padding: 7px 0;
  border-top: 1px solid var(--hairline);
}
.breakdown-row:first-child {
  border-top: none;
}
.breakdown-pts {
  font-family: "Rubik", sans-serif;
  font-weight: 700;
  color: var(--signal);
}

.imp-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.imp-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--hairline);
  font-size: 13.5px;
}
.imp-item:first-child {
  border-top: none;
}
.imp-reason {
  font-size: 11.5px;
  color: var(--fg-faint);
}
.badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  flex-shrink: 0;
}
.badge-high {
  background: var(--signal-soft);
  color: var(--signal);
}
.badge-medium {
  background: var(--warn-soft);
  color: var(--warn);
}
.badge-low {
  background: var(--confirm-soft);
  color: var(--confirm);
}
.empty-note {
  color: var(--fg-faint);
  font-size: 13px;
  padding: 6px 0;
}

.action-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 18px 22px;
  border-top: 1px solid var(--hairline);
  flex-wrap: wrap;
}
.btn-approve {
  background: var(--confirm);
  color: #06281c;
  border: none;
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
}
.btn-block {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
}
.btn-approve:hover {
  background: #4ee6ac;
}
.btn-block:hover {
  background: rgba(255, 90, 90, 0.1);
}
.btn-approve:disabled,
.btn-block:disabled,
.btn-run:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.decided-note {
  font-size: 12px;
  color: var(--fg-faint);
}

/* ---- modal ---- */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(5, 7, 10, 0.7);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: 10px;
  width: min(480px, 92vw);
  padding: 24px;
}
.modal h3 {
  font-size: 16px;
  margin-bottom: 18px;
}
.field {
  margin-bottom: 16px;
}
.field label {
  display: block;
  font-size: 12.5px;
  color: var(--fg-muted);
  margin-bottom: 6px;
}
.field select,
.field input[type="text"],
.field input[type="email"],
.field input[type="password"] {
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--hairline);
  color: var(--fg);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14px;
}
.checkfield {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}
.checkfield input {
  width: 16px;
  height: 16px;
  accent-color: var(--signal);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--fg-muted);
  padding: 9px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
}
.btn-run {
  background: var(--signal);
  color: #1a0e08;
  border: none;
  font-weight: 700;
  padding: 9px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
}

/* ---- map ---- */
.map-legend {
  display: flex;
  gap: 18px;
  font-size: 12px;
  color: var(--fg-muted);
  padding: 14px 18px;
  border-bottom: 1px solid var(--hairline);
  flex-wrap: wrap;
}
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
  margin-inline-end: 6px;
}

/* ---- policy ---- */
.policy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 900px) {
  .policy-grid {
    grid-template-columns: 1fr;
  }
}
.slider-row {
  margin-bottom: 20px;
}
.slider-row label,
.slider-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13.5px;
  margin-bottom: 8px;
}
.slider-row .val,
.slider-value {
  font-family: "Rubik", sans-serif;
  font-weight: 700;
  color: var(--signal);
}
.slider-hint {
  font-size: 12.5px;
  color: var(--fg-faint);
  margin-top: 6px;
}
.r-app input[type="range"] {
  width: 100%;
  accent-color: var(--signal);
}
.live-note {
  font-size: 12.5px;
  color: var(--fg-faint);
  margin-top: 4px;
}

/* ---- auth / landing ---- */
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.auth-card {
  width: min(420px, 94vw);
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 28px;
}
.auth-card h1 {
  font-size: 22px;
  margin-bottom: 6px;
}
.auth-sub {
  font-size: 13px;
  color: var(--fg-muted);
  margin-bottom: 22px;
}
.auth-error {
  color: var(--danger);
  font-size: 12.5px;
  margin-bottom: 12px;
}
.auth-note {
  color: var(--confirm);
  font-size: 12.5px;
  margin-bottom: 12px;
}
.btn-full {
  width: 100%;
  justify-content: center;
  text-align: center;
}
.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fg-faint);
  font-size: 12px;
  margin: 16px 0;
}
.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--hairline);
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--fg-muted);
  word-break: break-all;
  direction: ltr;
  text-align: left;
}

/* ---- hypotheses ---- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 14px 16px;
}
.stat-value {
  font-family: "Rubik", sans-serif;
  font-weight: 700;
  font-size: 26px;
  color: var(--signal);
  line-height: 1.2;
}
.stat-label {
  font-size: 12.5px;
  color: var(--fg-muted);
}
.hyp-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: start;
}
.days-pill {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 20px;
  font-weight: 600;
}
.days-ok {
  background: var(--confirm-soft);
  color: var(--confirm);
}
.days-warn {
  background: var(--warn-soft);
  color: var(--warn);
}
.days-bad {
  background: rgba(255, 90, 90, 0.14);
  color: var(--danger);
}
.hyp-status-active,
.hyp-status-evidence {
  background: var(--panel-3);
  color: var(--fg-muted);
}
.hyp-status-pr_open {
  background: var(--signal-soft);
  color: var(--signal);
}
.hyp-status-merged,
.hyp-status-kept_with_reason {
  background: var(--confirm-soft);
  color: var(--confirm);
}
.hyp-status-expired {
  background: rgba(255, 90, 90, 0.14);
  color: var(--danger);
}
.hyp-verdict-keep {
  background: var(--confirm-soft);
  color: var(--confirm);
}
.hyp-verdict-reduce {
  background: var(--warn-soft);
  color: var(--warn);
}
.hyp-verdict-remove {
  background: rgba(255, 90, 90, 0.14);
  color: var(--danger);
}
.hyp-detail-tags {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.hyp-detail-body {
  display: grid;
  gap: 14px;
}
.hyp-side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}
.diff-card {
  border-color: var(--signal);
  box-shadow: 0 0 0 1px rgba(255, 122, 69, 0.12);
}
.diff-note {
  font-size: 12.5px;
  color: var(--fg-muted);
  margin: 0 0 10px;
}
.diff-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.diff-col-title {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint);
  margin-bottom: 6px;
}
.diff-line {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 5px;
  font-size: 13px;
  direction: ltr;
  text-align: left;
  word-break: break-all;
}
.diff-line.keep {
  background: var(--confirm-soft);
  color: var(--confirm);
}
.diff-line.drop {
  background: rgba(255, 90, 90, 0.12);
  color: var(--danger);
  text-decoration: line-through;
}
.diff-sign {
  font-weight: 700;
}
.pr-link {
  display: inline-block;
  margin-top: 12px;
  background: var(--signal);
  color: #14100d;
  font-weight: 700;
  font-size: 13.5px;
  padding: 9px 18px;
  border-radius: 8px;
  text-decoration: none;
}
.pr-link:hover {
  filter: brightness(1.08);
}
.used-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.used-table th {
  text-align: start;
  color: var(--fg-faint);
  font-weight: 600;
  padding: 6px 4px;
  border-bottom: 1px solid var(--hairline);
}
.used-table td {
  padding: 7px 4px;
  border-bottom: 1px solid var(--hairline);
  color: var(--fg-muted);
}
.used-res {
  max-width: 220px;
  word-break: break-all;
  direction: ltr;
  text-align: left;
}
.granted-block {
  display: grid;
  gap: 4px;
}
.granted-list {
  font-size: 12.5px;
  color: var(--fg-muted);
  direction: ltr;
  text-align: left;
  word-break: break-all;
  margin-bottom: 8px;
}
.keep-input {
  width: 100%;
  background: var(--panel-3);
  border: 1px solid var(--hairline);
  border-radius: 8px;
  color: var(--fg);
  padding: 9px 11px;
  font-family: "Heebo", sans-serif;
  font-size: 13.5px;
  resize: vertical;
  margin-bottom: 10px;
}
.keep-input:focus {
  outline: none;
  border-color: var(--signal);
}
.keep-reason-saved {
  font-size: 12.5px;
  color: var(--confirm);
  background: var(--confirm-soft);
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 10px;
}
.run-row {
  border-bottom: 1px solid var(--hairline);
  padding: 12px 0;
}
.run-time {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.run-summary {
  background: var(--panel-3);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--fg-muted);
  direction: ltr;
  text-align: left;
  overflow-x: auto;
  margin: 0;
}
@media (max-width: 1080px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .hyp-grid,
  .hyp-side,
  .diff-grid {
    grid-template-columns: 1fr;
  }
}

/* ---- language switch ---- */
.lang-btn {
  background: transparent;
  border: 1px solid var(--hairline);
  color: var(--fg-muted);
  border-radius: 7px;
  padding: 5px 11px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.lang-btn:hover {
  color: var(--fg);
  border-color: var(--signal);
}

/* ---- map walkthrough ---- */
.walk-panel {
  margin-top: 18px;
}
.walk-body {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr);
  gap: 18px;
  padding: 18px 20px 22px;
}
.walk-graph {
  min-width: 0;
}
.walk-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.walk-change {
  font-size: 12px;
  color: var(--fg-faint);
}
.walk-step-title {
  font-family: "Rubik", sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--fg);
}
.walk-step-body {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--fg-muted);
  margin: 0;
}
.walk-verdict {
  align-self: flex-start;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
}
.walk-dots {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.walk-dot {
  width: 26px;
  height: 4px;
  border-radius: 3px;
  border: none;
  background: var(--hairline);
  cursor: pointer;
  padding: 0;
  transition: background 0.25s ease;
}
.walk-dot.on {
  background: var(--signal);
}
.walk-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.walk-hint {
  font-size: 11.5px;
  color: var(--fg-faint);
  line-height: 1.6;
}
@media (max-width: 900px) {
  .walk-body {
    grid-template-columns: 1fr;
  }
}
```

=== src/router.tsx ===
```
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
```

=== src/routes/_authenticated/app.changes.tsx ===
```
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useConsole, CONSOLE_QUERY_KEY } from "@/hooks/useConsole";
import { ChangeDetail } from "@/components/radius/ChangeDetail";
import { NewChangeModal } from "@/components/radius/NewChangeModal";
import { createChange, decideChange } from "@/lib/radius.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/changes")({
  head: () => ({
    meta: [
      { title: "Pending changes — Radius" },
      {
        name: "description",
        content: "The cloud infrastructure change queue, its risk scores and impacted resources.",
      },
      { property: "og:title", content: "Pending changes — Radius" },
      { property: "og:description", content: "The cloud change queue and its risk scores." },
    ],
  }),
  component: ChangesPage,
});

function ChangesPage() {
  const { data, isLoading, error } = useConsole();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const decideFn = useServerFn(decideChange);
  const createFn = useServerFn(createChange);

  useEffect(() => {
    const first = data?.changes[0];
    if (!first) return;
    setSelectedId((cur) => (cur && data.changes.some((c) => c.id === cur) ? cur : first.id));
  }, [data]);

  const decideMutation = useMutation({
    mutationFn: (vars: { changeId: string; decision: "approved" | "blocked" }) =>
      decideFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(t(vars.decision === "approved" ? "changes.approved" : "changes.blocked"));
      void queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("changes.actionFailed")),
  });

  const createMutation = useMutation({
    mutationFn: (vars: {
      title: string;
      targetResourceId: string;
      newAccessResourceId: string | null;
      scopeBroadened: boolean;
    }) => createFn({ data: vars }),
    onSuccess: async (res) => {
      setModalOpen(false);
      setSelectedId(res.id);
      toast.success(t("changes.simulationSaved"));
      await queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("changes.createFailed")),
  });

  if (isLoading) return <div className="empty-note">{t("changes.loading")}</div>;
  if (error || !data) return <div className="auth-error">{t("changes.loadError")}</div>;

  const selected = data.changes.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="dash-grid">
      <div className="panel">
        <div className="panel-head">
          <h3>{t("changes.title", { count: data.changes.length })}</h3>
          <button className="new-btn" onClick={() => setModalOpen(true)}>
            {t("changes.new")}
          </button>
        </div>
        {data.changes.length === 0 && (
          <div className="empty-note" style={{ padding: 18 }}>
            {t("changes.empty")}
          </div>
        )}
        {data.changes.map((c) => (
          <button
            key={c.id}
            className={`change-item ${c.id === selectedId ? "selected" : ""}`}
            onClick={() => setSelectedId(c.id)}
          >
            <div className="change-title">{c.title}</div>
            <div className="change-meta">
              <span>
                {c.author} · {t("changes.score", { score: c.simulation.score })}
              </span>
              <span className={`status-chip status-${c.status}`}>{t(`status.${c.status}`)}</span>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <ChangeDetail
          change={selected}
          data={data}
          deciding={decideMutation.isPending}
          onDecide={(decision) => decideMutation.mutate({ changeId: selected.id, decision })}
        />
      ) : (
        <div className="panel" style={{ padding: 22 }}>
          <div className="empty-note">{t("changes.pick")}</div>
        </div>
      )}

      {modalOpen && (
        <NewChangeModal
          resources={data.resources}
          busy={createMutation.isPending}
          onClose={() => setModalOpen(false)}
          onSubmit={(v) => createMutation.mutate(v)}
        />
      )}
    </div>
  );
}
```

=== src/routes/_authenticated/app.hypotheses.tsx ===
```
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HypothesisDetail } from "@/components/radius/HypothesisDetail";
import { useHypotheses, HYPOTHESES_QUERY_KEY } from "@/hooks/useHypotheses";
import { keepWithReason } from "@/lib/hypotheses.functions";
import { daysLeftTone } from "@/lib/hypotheses-types";
import { useI18n, daysLeftKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/hypotheses")({
  head: () => ({
    meta: [
      { title: "Permission hypotheses — Radius" },
      {
        name: "description",
        content:
          "Permissions with an expiry date, what was actually used and what the agent proposes to reduce.",
      },
      { property: "og:title", content: "Permission hypotheses — Radius" },
      { property: "og:description", content: "A permission either proves it is needed, or it goes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HypothesesPage,
});

const VERDICT_CLASS: Record<string, string> = {
  keep: "hyp-verdict-keep",
  reduce: "hyp-verdict-reduce",
  remove: "hyp-verdict-remove",
};

function HypothesesPage() {
  const { data, isLoading, error } = useHypotheses();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const keepFn = useServerFn(keepWithReason);

  useEffect(() => {
    const first = data?.hypotheses[0];
    if (!first) return;
    setSelectedId((cur) => (cur && data.hypotheses.some((h) => h.id === cur) ? cur : first.id));
  }, [data]);

  const keepMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => keepFn({ data: vars }),
    onSuccess: () => {
      toast.success(t("hyp.saved"));
      void queryClient.invalidateQueries({ queryKey: HYPOTHESES_QUERY_KEY });
    },
    onError: () => toast.error(t("hyp.saveFailed")),
  });

  if (isLoading) return <div className="empty-note">{t("hyp.loading")}</div>;
  if (error) return <div className="empty-note">{t("hyp.loadError")}</div>;
  if (!data) return null;

  const selected = data.hypotheses.find((h) => h.id === selectedId) ?? null;

  const stats = [
    { key: "hyp.statActive", value: data.summary.active },
    { key: "hyp.statExpiring", value: data.summary.expiringThisWeek },
    { key: "hyp.statPrs", value: data.summary.openPrs },
    { key: "hyp.statRemoved", value: data.summary.removedLast30Days },
  ];

  return (
    <>
      <div className="stat-row">
        {stats.map((s) => (
          <div className="stat-card" key={s.key}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{t(s.key)}</div>
          </div>
        ))}
      </div>

      <div className="hyp-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>{t("hyp.title")}</h3>
            <span className="env-tag">{t("hyp.sorted")}</span>
          </div>
          {data.hypotheses.length === 0 && <div className="empty-note">{t("hyp.empty")}</div>}
          {data.hypotheses.map((h) => {
            const dl = daysLeftKey(h.daysLeft);
            return (
              <div
                key={h.id}
                className={`change-item ${h.id === selectedId ? "selected" : ""}`}
                onClick={() => setSelectedId(h.id)}
              >
                <div className="change-title">{h.label ?? h.sid}</div>
                <div className="change-meta">
                  <span className="mono">{h.roleName}</span>
                  <span className={`days-pill days-${daysLeftTone(h.daysLeft)}`}>
                    {t(dl.key, dl.params)}
                  </span>
                  <span className={`status-chip hyp-status-${h.status}`}>
                    {t(`hypStatus.${h.status}`)}
                  </span>
                  {h.verdict && (
                    <span className={`status-chip ${VERDICT_CLASS[h.verdict]}`}>{h.verdict}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected ? (
          <HypothesisDetail
            hypothesis={selected}
            saving={keepMutation.isPending}
            onKeep={(reason) => keepMutation.mutate({ id: selected.id, reason })}
          />
        ) : (
          <div className="panel">
            <div className="empty-note">{t("hyp.pick")}</div>
          </div>
        )}
      </div>
    </>
  );
}
```

=== src/routes/_authenticated/app.index.tsx ===
```
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/changes" });
  },
});
```

=== src/routes/_authenticated/app.map.tsx ===
```
import { createFileRoute } from "@tanstack/react-router";
import { useConsole } from "@/hooks/useConsole";
import { GraphSvg } from "@/components/radius/GraphSvg";
import { MapWalkthrough } from "@/components/radius/MapWalkthrough";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/map")({
  head: () => ({
    meta: [
      { title: "Dependency map — Radius" },
      {
        name: "description",
        content: "The full dependency map between services, permissions and data stores.",
      },
      { property: "og:title", content: "Dependency map — Radius" },
      { property: "og:description", content: "The full dependency map of your cloud infrastructure." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { data, isLoading } = useConsole();
  const { t } = useI18n();

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>{t("map.title")}</h3>
        </div>
        <div className="map-legend">
          <span>
            <span className="legend-dot" style={{ background: "#FF7A45" }} />
            {t("map.legendRole")}
          </span>
          <span>
            <span className="legend-dot" style={{ background: "#4C86FF" }} />
            {t("map.legendService")}
          </span>
          <span>
            <span className="legend-dot" style={{ background: "#B26BFF" }} />
            {t("map.legendData")}
          </span>
          <span>
            <span className="legend-dot" style={{ background: "#5B6672" }} />
            {t("map.legendExternal")}
          </span>
        </div>
        <div style={{ padding: 20 }}>
          {isLoading || !data ? (
            <div className="empty-note">{t("map.loading")}</div>
          ) : (
            <GraphSvg resources={data.resources} edges={data.edges} />
          )}
        </div>
      </div>

      {data && <MapWalkthrough data={data} />}
    </>
  );
}
```

=== src/routes/_authenticated/app.policy.tsx ===
```
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useConsole, CONSOLE_QUERY_KEY } from "@/hooks/useConsole";
import { saveWeights } from "@/lib/radius.functions";
import { useI18n } from "@/lib/i18n";
import type { PolicyWeights } from "@/lib/radius-types";

export const Route = createFileRoute("/_authenticated/app/policy")({
  head: () => ({
    meta: [
      { title: "Risk policy — Radius" },
      {
        name: "description",
        content: "Tune the risk engine weights and the approval threshold of your organization.",
      },
      { property: "og:title", content: "Risk policy — Radius" },
      { property: "og:description", content: "Tune your organization's risk engine weights." },
    ],
  }),
  component: PolicyPage,
});

const SLIDERS: { key: keyof PolicyWeights; min: number; max: number }[] = [
  { key: "threshold", min: 30, max: 90 },
  { key: "sensHigh", min: 0, max: 40 },
  { key: "sensMedium", min: 0, max: 40 },
  { key: "sensLow", min: 0, max: 40 },
  { key: "scopeBonus", min: 0, max: 40 },
  { key: "complianceBonus", min: 0, max: 40 },
];

function PolicyPage() {
  const { data, isLoading } = useConsole();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PolicyWeights | null>(null);
  const saveFn = useServerFn(saveWeights);

  useEffect(() => {
    if (data) setDraft(data.weights);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (w: PolicyWeights) => saveFn({ data: w }),
    onSuccess: async () => {
      toast.success(t("policy.saved"));
      await queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY });
    },
    onError: () => toast.error(t("policy.saveFailed")),
  });

  if (isLoading || !draft) return <div className="empty-note">{t("policy.loading")}</div>;

  return (
    <div className="panel policy-panel">
      <div className="panel-head">
        <h3>{t("policy.title")}</h3>
      </div>
      <div style={{ padding: 20 }}>
        <p className="detail-sub" style={{ marginBottom: 20 }}>
          {t("policy.intro")}
        </p>
        {SLIDERS.map((s) => (
          <div className="slider-row" key={s.key}>
            <div className="slider-label">
              <span>{t(`policy.${s.key}`)}</span>
              <span className="slider-value">{draft[s.key]}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={draft[s.key]}
              onChange={(e) => setDraft({ ...draft, [s.key]: Number(e.target.value) })}
            />
            <div className="slider-hint">{t(`policy.${s.key}Hint`)}</div>
          </div>
        ))}
        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <button
            className="btn-run"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(draft)}
          >
            {t("policy.save")}
          </button>
          <button className="btn-ghost" onClick={() => data && setDraft(data.weights)}>
            {t("policy.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

=== src/routes/_authenticated/app.runs.tsx ===
```
import { createFileRoute } from "@tanstack/react-router";
import { useAgentRuns } from "@/hooks/useHypotheses";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/runs")({
  head: () => ({
    meta: [
      { title: "Agent runs — Radius" },
      { name: "description", content: "Run history of the Radius agent and a summary of each run." },
      { property: "og:title", content: "Agent runs — Radius" },
      { property: "og:description", content: "When the agent ran and what it found each time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RunsPage,
});

function RunsPage() {
  const { data, isLoading, error } = useAgentRuns();
  const { t, locale } = useI18n();
  const runs = data ?? [];

  if (isLoading) return <div className="empty-note">{t("runs.loading")}</div>;
  if (error) return <div className="empty-note">{t("runs.loadError")}</div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t("runs.title")}</h3>
        <span className="env-tag">{t("runs.last")}</span>
      </div>
      {runs.length === 0 && <div className="empty-note">{t("runs.empty")}</div>}
      {runs.map((run) => (
        <div className="run-row" key={run.id}>
          <div className="run-time">
            {new Date(run.ranAt).toLocaleString(locale, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <pre className="run-summary mono">{run.summary ?? "—"}</pre>
        </div>
      ))}
    </div>
  );
}
```

=== src/routes/_authenticated/app.tsx ===
```
import { createFileRoute, Outlet, useRouterState, Link } from "@tanstack/react-router";
import { RadiusLogo } from "@/components/radius/RadiusLogo";
import { useConsole } from "@/hooks/useConsole";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app")({
  component: ConsoleLayout,
});

const TABS = [
  { to: "/app/changes", key: "nav.changes" },
  { to: "/app/hypotheses", key: "nav.hypotheses" },
  { to: "/app/map", key: "nav.map" },
  { to: "/app/policy", key: "nav.policy" },
  { to: "/app/runs", key: "nav.runs" },
] as const;

function ConsoleLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useConsole();
  const { t, toggleLang } = useI18n();

  return (
    <>
      <div className="topbar">
        <div className="logo">
          <RadiusLogo />
          Radius
        </div>
        <div className="tabs">
          {TABS.map((tab) => (
            <Link key={tab.to} to={tab.to}>
              <span className={`tab-btn ${pathname === tab.to ? "active" : ""}`}>{t(tab.key)}</span>
            </Link>
          ))}
        </div>
        <div className="topbar-right">
          <button className="lang-btn" onClick={toggleLang} title={t("nav.langTitle")}>
            {t("nav.lang")}
          </button>
          <span className="env-tag">production · {data?.orgName ?? "…"}</span>
        </div>
      </div>
      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
```

=== src/routes/_authenticated/route.tsx ===
```
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // No sign-up / login step: if there is no session yet, silently provision
    // one so the visitor lands straight in the console with their own org.
    const { data } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };

    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw new Error("Could not start a console session");
    return { user: anon.user };
  },
  component: () => <Outlet />,
});
```

=== src/routes/index.tsx ===
```
import { createFileRoute, Link } from "@tanstack/react-router";
import { RadiusLogo } from "@/components/radius/RadiusLogo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radius — know what will change before production" },
      {
        name: "description",
        content:
          "Radius analyzes every cloud permission and configuration change, computes a transparent risk score and shows exactly which services are impacted.",
      },
      { property: "og:title", content: "Radius — risk analysis for cloud infrastructure changes" },
      {
        property: "og:description",
        content: "A transparent risk engine, a dependency map and a blast radius simulation for every change.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, toggleLang } = useI18n();

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ width: "min(560px, 94vw)" }}>
        <div
          className="logo"
          style={{ marginBottom: 18, display: "flex", justifyContent: "space-between" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <RadiusLogo />
            Radius
          </span>
          <button className="lang-btn" onClick={toggleLang} title={t("nav.langTitle")}>
            {t("nav.lang")}
          </button>
        </div>
        <h1>{t("landing.title")}</h1>
        <p className="auth-sub" style={{ marginTop: 10 }}>
          {t("landing.sub")}
        </p>
        <Link to="/app/changes" className="new-btn btn-full" style={{ display: "inline-block" }}>
          {t("landing.cta")}
        </Link>
      </div>
    </div>
  );
}
```

=== src/routes/README.md ===
```
# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` (dynamic — bare `$`, no curly braces) |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment) |
| `files/$.tsx` | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx` | layout route (renders children via `<Outlet />`) |
| `__root.tsx` | app shell — wraps every page; preserve `<Outlet />` |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.
```

=== src/routes/__root.tsx ===
```
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          The address you asked for does not exist or has moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="new-btn">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}


function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page failed to load</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          Something went wrong. You can try again or go back to the home page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            className="new-btn"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a href="/" className="btn-ghost">
            Home
          </a>
        </div>

      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Radius — risk analysis for cloud infrastructure changes" },
      {
        name: "description",
        content:
          "Radius analyzes every planned cloud infrastructure change and shows what will be impacted before it reaches production.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&family=Heebo:wght@300;400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>

        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <div className="r-app">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster position="top-center" />
        </div>
      </LanguageProvider>
    </QueryClientProvider>

  );
}
```

=== src/server.ts ===
```
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
```

=== src/start.ts ===
```
import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
```

=== src/styles.css ===
```
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
@import "./radius.css";

@custom-variant dark (&:is(.dark *));

/*
 * Design system definition.
 *
 * The @theme inline block maps CSS custom properties to Tailwind utility
 * classes (e.g. --color-primary -> bg-primary, text-primary).
 *
 * The :root and .dark blocks define the actual color values using oklch.
 * All colors MUST use oklch format.
 *
 * To add a new semantic color:
 * 1. Add the variable to :root (light value) and .dark (dark value)
 * 2. Register it in @theme inline as --color-<name>: var(--<name>)
 */

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-ring-offset-background: var(--background);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.984 0.003 247.858);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.984 0.003 247.858);
  --sidebar-foreground: oklch(0.129 0.042 264.695);
  --sidebar-primary: oklch(0.208 0.042 265.755);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.968 0.007 247.896);
  --sidebar-accent-foreground: oklch(0.208 0.042 265.755);
  --sidebar-border: oklch(0.929 0.013 255.508);
  --sidebar-ring: oklch(0.704 0.04 256.788);
}

.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.929 0.013 255.508);
  --primary-foreground: oklch(0.208 0.042 265.755);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.279 0.041 260.031);
  --accent-foreground: oklch(0.984 0.003 247.858);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.984 0.003 247.858);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}
```

=== supabase/config.toml ===
```
project_id = "evpnuqziczzsusiqvlcr"```

=== tsconfig.json ===
```
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts", "eslint.config.js"],
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],

    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": false,
    "noEmit": true,

    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedSideEffectImports": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

=== vite.config.ts ===
```
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
```
