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

## 7. סטטוס המימוש בפרויקט

| נושא | סטטוס |
|---|---|
| מנוע BFS ($O(\|V\|+\|E\|)$) + ניקוד בשרת + הקפאת ציון היסטורי | ✅ עובד ומכוסה בבדיקות |
| RLS + אינדקסים + דמו אוטומטי + מצב מקומי עמיד (`.radius-local-db.json`) | ✅ עובד |
| Realtime בין חברי ארגון | ✅ עובד |
| מסכי changes / map / policy (עם תצוגה מקדימה חיה) / hypotheses / runs / audit | ✅ עובדים |
| i18n אנגלית/עברית + RTL | ✅ עובד |
| סנכרון טופולוגיית ענן מ-JSON / Terraform State (`+ Sync topology JSON` + סידור אוטומטי) | ✅ עובד |
| נקודת קצה `POST /api/public/ingest` ל-webhook מ-CI + GitHub Action | ✅ עובד |
| ניתוח אוטומטי של `terraform show -json` ו-AWS IAM Policy JSON (`src/lib/iac-parser.ts`) | ✅ עובד |
| בדיקות יחידה אוטומטיות (`npm test` ב-`src/lib/__tests__/radius.test.ts`) | ✅ 21 בדיקות עוברות |
| סוכן היפותזות אוטונומי (`runHypothesesAgent` ב-`src/lib/agent-runner.server.ts`) | ✅ עובד (ניתן להרצה מידית ממסך ריצות סוכן) |
