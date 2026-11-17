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
  "nav.audit": "Audit & CI",
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
  "detail.notePlaceholder":
    "Optional reviewer justification / ticket reference (logged to audit trail)…",

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
  "modal.importIac": "Import Terraform plan / IAM policy JSON",
  "modal.iacPlaceholder": 'Paste terraform show -json or AWS IAM {"Statement":[...]} JSON…',
  "modal.parseBtn": "Parse JSON",
  "modal.parseSuccess": "Parsed IaC JSON and matched resources",
  "modal.parseError": "Could not parse Terraform / IAM JSON",

  "map.title": "Full dependency map",
  "map.loading": "Loading map…",
  "map.legendRole": "Permission / role",
  "map.legendService": "Service",
  "map.legendData": "Database / storage",
  "map.legendExternal": "External",
  "map.searchPlaceholder": "Filter by name, key, or tag…",
  "map.filterAll": "All",
  "map.filterHigh": "High sensitivity",
  "map.filterPii": "PII / Compliance",
  "map.autoLayout": "Auto-layout",
  "map.savedLayout": "Saved layout",
  "map.syncBtn": "+ Sync topology JSON",
  "map.syncTitle": "Sync cloud topology / Terraform state",
  "map.syncPlaceholder":
    'Paste {"resources":[{"key":"orders-db","type":"database","sensitivity":"high","tags":["pii"]}],"edges":[{"from":"payments-service","to":"orders-db"}]}…',
  "map.syncAction": "Import topology",
  "map.syncSuccess": "Topology synced ({res} resources, {edges} edges added)",
  "map.syncError": "Invalid topology JSON",

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
  "walk.s2.body":
    "{count} services call {target} directly and inherit the new permission instantly.",
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
  "policy.previewTitle": "Live simulation preview",
  "policy.previewSub": "See how the draft weights affect an existing change before saving.",
  "policy.previewSelect": "Preview change",

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
  "runs.runNow": "Run agent now",
  "runs.running": "Running…",
  "runs.completed": "Agent run completed and hypotheses updated",
  "runs.failed": "Agent run failed",

  "audit.title": "Compliance audit trail",
  "audit.exportCsv": "Export CSV",
  "audit.exportJson": "Export JSON",
  "audit.empty": "No audit events recorded yet.",
  "audit.ciTitle": "CI/CD Webhook Gatekeeper",
  "audit.ciSub":
    "Send Terraform plans or IAM policy JSON from GitHub Actions to compute blast radius and gate high-risk merges automatically.",
  "audit.endpoint": "Webhook endpoint",
  "audit.ingestKey": "Organization ingest key",
  "audit.exampleCurl": "Example CI command",
  "audit.copy": "Copy",
  "audit.copied": "Copied to clipboard",
};

const HE: Record<string, string> = {
  "nav.changes": "שינויים ממתינים",
  "nav.hypotheses": "היפותזות",
  "nav.map": "מפת תלויות",
  "nav.policy": "מדיניות",
  "nav.runs": "ריצות סוכן",
  "nav.audit": "ביקורת ו-CI",
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
  "detail.notePlaceholder": "הערת מאשר / מספר טיקט (נשמר ביומן הביקורת)…",

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
  "modal.importIac": "ייבוא Terraform plan / IAM policy JSON",
  "modal.iacPlaceholder": 'הדבק כאן terraform show -json או AWS IAM {"Statement":[...]}…',
  "modal.parseBtn": "נתח JSON",
  "modal.parseSuccess": "ה-JSON נותח והמשאבים הותאמו",
  "modal.parseError": "לא ניתן לנתח את ה-JSON",

  "map.title": "מפת התלויות המלאה",
  "map.loading": "טוען מפה…",
  "map.legendRole": "הרשאה / role",
  "map.legendService": "שירות",
  "map.legendData": "מאגר נתונים / אחסון",
  "map.legendExternal": "חיצוני",
  "map.searchPlaceholder": "סינון לפי שם, מפתח או תגית…",
  "map.filterAll": "הכל",
  "map.filterHigh": "רגישות גבוהה",
  "map.filterPii": "PII / ציות",
  "map.autoLayout": "סידור אוטומטי",
  "map.savedLayout": "סידור שמור",
  "map.syncBtn": "+ סנכרון טופולוגיה",
  "map.syncTitle": "סנכרון טופולוגיית ענן / Terraform state",
  "map.syncPlaceholder": 'הדבק {"resources":[...],"edges":[...]}…',
  "map.syncAction": "ייבא טופולוגיה",
  "map.syncSuccess": "הטופולוגיה סונכרנה ({res} משאבים, {edges} קשרים נוספו)",
  "map.syncError": "קובץ טופולוגיה לא תקין",

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
  "policy.previewTitle": "תצוגה מקדימה חיה",
  "policy.previewSub": "בדוק כיצד המשקלים החדשים משפיעים על שינוי קיים לפני השמירה.",
  "policy.previewSelect": "שינוי לבדיקה",

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
  "runs.runNow": "הרץ סוכן עכשיו",
  "runs.running": "מריץ…",
  "runs.completed": "ריצת הסוכן הושלמה וההיפותזות עודכנו",
  "runs.failed": "ריצת הסוכן נכשלה",

  "audit.title": "יומן ביקורת וציות (Audit Log)",
  "audit.exportCsv": "ייצוא CSV",
  "audit.exportJson": "ייצוא JSON",
  "audit.empty": "אין אירועי ביקורת עדיין.",
  "audit.ciTitle": "חיבור Webhook ל-CI/CD",
  "audit.ciSub":
    "שלח תוכניות Terraform או מדיניות IAM מ-GitHub Actions לחישוב Blast Radius וחסימת מיזוגים בסיכון גבוה.",
  "audit.endpoint": "כתובת ה-Webhook",
  "audit.ingestKey": "מפתח Ingest ארגוני",
  "audit.exampleCurl": "דוגמת הרצה מ-CI",
  "audit.copy": "העתק",
  "audit.copied": "הועתק ללוח",
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
