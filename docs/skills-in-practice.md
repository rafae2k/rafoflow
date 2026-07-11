# Skills in practice

The rafoflow README tells you _what_ each skill and agent is. This guide shows you _what they produce_ — a realistic input and a realistic slice of the output for every one, following each skill's own format. Read it when the one-liner isn't enough and you want to see the shape of the thing before you run it.

## The fleet, in one breath

rafoflow is Shape Up wired into Claude Code as two surfaces. **Skills** are inline methodology — slash commands that apply a method (and its output template) in the current conversation. **Agents** are autonomous workers you spawn; they run in isolated context, read code, and come back with a result. Same discipline, different blast radius: reach for a skill when you want to drive step by step and keep the output in front of you; spawn an agent when you want multi-step work done out of band without bloating the main thread.

The opinions are the product. Fixed time, variable scope. Constraints beat instructions — every agent knows what it must _never_ do. Honesty anchors — "I don't know" and "this failed" over faked success. rafoflow is the _method_; its companion **[rafoworks](https://github.com/rafae2k/rafoworks)** is the _enforcement_ — a Cloudflare Workers boilerplate whose deploy gate, docs-lint, and changelog guard turn "you own the doc" and "iterate until green" from good intentions into hooks that block a red build. Install rafoflow to work this way anywhere; start from rafoworks to have it held for you.

The examples below follow one running product — a workout-tracking app — so the artifacts connect: an idea gets shaped, bet on, scoped, cut, built, reviewed, and shipped. `/debug` and `/market-research` branch off with their own scenarios where that fits the skill better.

---

## `/shape` — raw idea → a pitch with a fixed appetite

**Input:** `/shape let users export their workout history as a spreadsheet`

`/shape` refuses to hand back a task list. It interrogates the problem, sets an appetite (time this is _worth_, not what it'll _take_), sketches 3–5 fat-marker elements, names the rabbit holes, and draws hard no-go lines. Output:

```text
## PITCH: Export workout history as CSV

**Problem**
Power users want their training data outside the app — to chart it in a spreadsheet, share it with a coach, or keep a backup. Today the only way out is screenshots. If we do nothing, the most engaged users feel locked in.

**Appetite**
Small: 1 day. This is a convenience escape hatch, not a reporting product. If it costs more than a day, we're building the wrong thing.

**Solution**
- Export button: lives on the History screen, one tap, no config screen.
- CSV builder: one row per workout — date, type, duration, distance, notes.
- Delivery: generate the file client-side and hand it to the OS share sheet.

**Rabbit Holes**
- "Pick your columns / date range / format" → out of scope. One canonical CSV, all history.
- Huge histories (10k+ workouts) blocking the UI thread → build the string in a background task; solved now, not later.
- Excel mangling commas and UTF-8 → quote every field, prepend a BOM. Decided, not deferred.

**No-Gos**
- NOT building XLSX, PDF, or JSON. CSV only.
- NOT building scheduled or cloud exports. Manual, on-device, on demand.
- NOT a column picker or a settings screen.
```

Notice what it did _not_ do: no "create model / build UI / write tests" breakdown, no appetite stretch to fit the wish list. When the wish list didn't fit, features got cut — the column picker became a no-go instead of a bigger budget.

---

## `/bet` — the betting table says build, kill, or reshape

**Input:** the pitch above, piped to `/bet`.

`/bet` is a decision, not a discussion. It walks four gates in order — problem real? appetite right? right time? shaped well enough? — and stops at the first "no." No "it depends," no "let's A/B test it," no roadmap.

```text
## BET DECISION: Export workout history as CSV

**Verdict: BET**

**Reasoning**
Real problem, real users — the ones who'd churn are exactly the ones asking. The appetite is honest: a one-day escape hatch, not a reporting suite. Rabbit holes are already de-risked in the pitch (Excel encoding, big-history threading), and the no-gos are specific enough that a builder won't wander into a column picker. Ship it this cycle.

**Start with:**
The CSV builder — it's the only part with any uncertainty (encoding, threading). Prove the file opens cleanly in Excel and Sheets before touching the button. If that's solid, the rest is wiring.
```

Had the pitch arrived with "Appetite: as long as it takes" and a JSON+XLSX+scheduled-export wish list, the verdict would have been **RESHAPE** with the specific cut ("one format, one day"). "Nice to have" is never a verdict — it's a kill.

---

## `/scope` — a pitch → 3–5 independent, valuable slices

**Input:** the bet-approved pitch, piped to `/scope`.

Scopes are vertical slices, not disciplines. Each one, when done, makes something _new_ work for the user — never "the backend scope" then "the UI scope." Most uncertain first, so the scary part gets proven early.

```text
## SCOPES: Export workout history as CSV

**Appetite:** Small — 1 day

### Scope 1: Correct CSV for one workout ← START HERE
**Done when:** A single workout serializes to a CSV string that opens clean in Excel and Google Sheets — commas, quotes, and accented notes intact.
**Key elements:**
- Field escaping (quote-wrap, double interior quotes) + UTF-8 BOM
- Column order fixed: date, type, duration, distance, notes
**Uncertainty:** High — encoding is where CSV export actually breaks.

### Scope 2: Export the full history
**Done when:** Every workout for the user, oldest to newest, builds into one file off the UI thread without jank on a 10k-row account.
**Key elements:**
- Stream/batch the rows; build off the main thread
- Header row once, then N data rows
**Uncertainty:** Medium — large histories are the perf risk.

### Scope 3: Get the file to the user
**Done when:** Tapping Export on History produces the file and opens the OS share sheet.
**Key elements:**
- Export button on History
- Hand the file to the native share sheet
**Uncertainty:** Low — standard platform wiring.

**Appetite check:** 1 day → ~0.5d Scope 1, ~0.25d Scope 2, ~0.25d Scope 3.

**Won't do (from pitch no-gos):**
- No column picker, no date range, no XLSX/PDF/JSON, no scheduled or cloud export.
```

Three scopes, each shippable in a sitting, the hardest one first, and the no-gos carried forward verbatim so scope creep has nothing to hide behind.

---

## `/cut` — the scope-hammer when you're over appetite

**Input:** `/cut` — half the day is gone and only Scope 1 is done; encoding ate the morning.

`/cut` never touches the deadline. It classifies must/should/nice, kills "nice to have" without ceremony, and finds the 20%-effort version of what stays.

```text
## CUT PLAN: Export workout history as CSV

**Appetite remaining:** ~half a day

**KEEP (must ship):**
- CSV builder (Scope 1) — done, and it's the whole point.
- Export button + share sheet (Scope 3) — without delivery there's no feature.

**SIMPLIFY (reduce effort):**
- Full-history threading (Scope 2) → ship it synchronous with a simple spinner. Building off-thread is the "right" version; a spinner over a 1–2s export is the 20% version that no user will notice. Revisit only if real accounts actually jank.

**CUT (remove entirely):**
- The "exporting…" progress percentage — nice-to-have polish on an operation that finishes in a second. The user survives without it.

**Revised scope fits appetite:** Yes
```

Had cutting everything non-essential still blown the budget, `/cut` pulls the **circuit breaker**: stop building, the pitch was scoped wrong, go back to `/shape`. That's the system working, not failing.

---

## `/engineer` — apply the principles to a small change

**Input:** `/engineer the CSV field escaper — make it solid`

A first pass reached for a config bag "so we can support other formats later." `/engineer` runs every decision through "is this the simplest thing that solves the problem?" — and YAGNI, "config option that could be a decision," and "boolean parameter that changes behavior" all fire at once. Before:

```ts
// Before: configurable for formats we don't have and a boolean that forks behavior
function escapeField(
  value: string,
  opts: { delimiter?: string; quote?: string; alwaysQuote?: boolean } = {},
) {
  const delimiter = opts.delimiter ?? ",";
  const quote = opts.quote ?? '"';
  const needsQuote =
    opts.alwaysQuote ||
    value.includes(delimiter) ||
    value.includes(quote) ||
    value.includes("\n");
  if (!needsQuote) return value;
  return quote + value.split(quote).join(quote + quote) + quote;
}
```

The reasoning, out loud: the app emits exactly one format. `delimiter` and `quote` are config options that could be decisions — decide for the user. `alwaysQuote` is a boolean that changes behavior — and the safe answer is "always quote," so the branch is dead weight. Deleting all three is deleting a liability. After:

```ts
// After: one format, always quoted, no knobs to misconfigure
function escapeField(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}
```

Fewer lines, one obvious behavior, nothing to test that the app never exercises. `/engineer` then closes the loop the way the skill demands: a unit test for the escaping edge cases (embedded quotes, commas, newlines) _plus_ one seam test that writes a real file and re-opens it — because a mock that returns "the CSV you wished for" lies, and the dangerous bugs live between the builder and the OS, not inside the escaper. It runs the gate (typecheck + lint + build + test) as its iteration loop, not a final checkpoint, and never ends the turn on red.

---

## `/debug` — the scientific method, end to end

This is the deep one. `/debug` treats a bug as a hypothesis to test, never code to poke at randomly. Walk it on a real-shaped bug.

**Input:** `/debug the weekly summary shows 0 workouts for some users even though they logged workouts this week`

### 1. Reproduce first

A bug you can't trigger is a bug you can't investigate. Minimizing the conditions: it only reproduces for users east of UTC who log in the late local evening. Concretely — device set to UTC+13, log a workout Sunday 23:30 local, open the weekly summary: the workout is missing from this week.

### 2. Describe the gap

```text
Expected: a workout logged Sunday 23:30 local time counts in that local week's summary.
Actual:   it's absent — the week shows one fewer workout, sometimes 0.
When:     users far east of UTC, logging late local evening near a week boundary.
```

If you can't write these three lines, you don't understand the bug yet.

### 3. List hypotheses — each with what would confirm or disprove it

```text
1. Timestamps stored without timezone (naive local strings).
   confirm: DB column is TEXT with no offset. disprove: values are ISO-8601 with Z.
2. Week bucketing runs in UTC, not the user's local date.
   confirm: bucket boundary is UTC midnight. disprove: boundary honors user tz.
3. Off-by-one week start (Sunday vs Monday).
   confirm: every user is shifted by exactly one day. disprove: only far-east users, only late evening.
4. The summary query's date window drops the row (JOIN/filter).
   confirm: the row is absent from the query result. disprove: it's present but mis-bucketed.
5. Client caches a stale summary.
   confirm: forced refetch fixes it. disprove: server response itself is wrong.
```

Prioritize the experiments that _disprove_ — elimination is faster than confirmation. Hypothesis 3 dies immediately: it isn't every user, and it correlates with evening + far-east, which points straight at a UTC boundary. Hypothesis 5 dies on a forced refetch that changes nothing.

### 4. Binary search the execution path

Don't read the whole codebase — halve it. The chain is: stored row → summary query → bucketing function → rendered count. Check state at the midpoint.

```text
Row in DB:            logged_at = 2026-03-01T10:30:00Z   ✓ correct instant, tz-aware  → H1 eliminated
Query returns it:     yes, row is in the result set       ✓                            → H4 eliminated
Bucketing input:      2026-03-01T10:30:00Z                ✓
Bucketing output:     week_of = 2026-02-23 (prev week)    ✗  ← bug is here
Rendered count:       faithfully renders the wrong bucket
```

State is correct going into the bucketing function and wrong coming out. The fault is in that function — everything up- and downstream is exonerated. Hypothesis 2 stands.

### 5. Five whys → root cause

```text
1. Why is the workout in the wrong week? → It bucketed into the prior week.
2. Why the prior week? → Bucketing computed the week from the UTC calendar date (Feb 28 UTC), not the user's local date (Mar 1 local).
3. Why UTC? → weekOf() calls new Date(ts) and reads UTC getters, ignoring the user's timezone.
4. Why does it ignore tz? → It never receives the user's tz; every other date view converts to local first, this path didn't.
5. Root cause: an async-loaded user timezone is applied everywhere the app renders dates EXCEPT the summary bucketer — a pattern inconsistency, not a one-off typo.
```

A symptom is not a cause. "Shows 0 workouts" is the symptom; "bucketing by UTC date instead of user-local date" is the cause. Adding a `?? 0` guard on the count would hide it and ship a new bug.

### 6. Fix at the root, change one thing

```ts
// Before: buckets by the UTC calendar date
function weekOf(loggedAt: string): string {
  const d = new Date(loggedAt);
  return startOfWeekUTC(d);
}

// After: buckets by the user's local calendar date — same convention as every other date view
function weekOf(loggedAt: string, userTimeZone: string): string {
  const local = toZonedDate(loggedAt, userTimeZone);
  return startOfWeek(local);
}
```

### 7. Regression test — fails before, passes after

```ts
// The exact reproduction case, frozen as a test. No fix ships without it.
test("late-evening local workout buckets into the local week, not UTC", () => {
  // 2026-03-01 23:30 in UTC+13  ==  2026-03-01T10:30:00Z
  expect(weekOf("2026-03-01T10:30:00Z", "Pacific/Auckland")).toBe(
    weekOf("2026-03-02T00:00:00Z", "Pacific/Auckland"),
  );
});
```

### 8. Similar patterns to check

If the bucketer read UTC, what else does? Grep for the same anti-pattern: the streak counter, the "today's workouts" list, and local-notification scheduling all likely bucket in UTC too. Fix the class, not just the instance.

The skill's own one-note record:

```text
## Bug: weekly summary undercounts / shows 0 for far-east users
Root cause: weekOf() bucketed by UTC calendar date instead of the user's local date; the app's tz-conversion pattern was applied everywhere except this path.
Fix: pass userTimeZone into weekOf(); convert to local before computing the week.
Prevents recurrence: regression test on a UTC+13 late-evening timestamp; audit of streak/today/notification bucketing for the same UTC leak.
```

### Investigating production data — when the bug lives in the live system

Reproduction proved the mechanism. Now size the blast radius against production — and the production rules kick in, because a wrong query yields a _confident_ wrong conclusion. **Query the source of truth directly** (not a dashboard that may filter or diverge), **never assume a status/field's meaning** before reading its real distribution, and **verify the premise before concluding**.

Before filtering on anything, read what the field actually holds — is "logged at" the moment of the workout, or the moment it synced from the watch? Those diverge for offline logs, and picking the wrong one would mis-size the impact:

```sql
-- Never assume the field's meaning — read the real distribution first.
SELECT
  CASE WHEN logged_at = synced_at THEN 'same' ELSE 'differ' END AS ts_relation,
  COUNT(*)
FROM workouts
WHERE logged_at >= '2026-01-01'
GROUP BY ts_relation;
```

Then prove the premise — that far-east, late-evening logs are the ones landing in the wrong week — and reconcile the count against a known baseline before presenting it:

```sql
-- How many workouts sit in the danger zone: late local evening, user east of UTC?
SELECT u.tz_offset_minutes, COUNT(*) AS at_risk
FROM workouts w
JOIN users u ON u.id = w.user_id
WHERE u.tz_offset_minutes > 0
  AND CAST(strftime('%H', w.logged_at, (u.tz_offset_minutes || ' minutes')) AS INT) >= 22
GROUP BY u.tz_offset_minutes
ORDER BY at_risk DESC;
```

Sanity-check that total against the period's overall workout count — if "affected" comes back larger than "all late-evening logs," the query is wrong, so investigate; don't ship the number. And **"not implemented" needs double proof**: before ever claiming the local-time path doesn't exist, grep the code _and_ query production — the far more common story is that it's already there under a different name.

---

## `/review` — less software, more quality

**Input:** `/review the CSV export changes` (or spawn `@reviewer`).

`/review` reads in priority order — architecture, blast radius, simplicity, correctness, quality — and stops going deeper once it finds a blocker. It labels comments and never blocks on a nit.

```text
## REVIEW: CSV export (builder + button + share sheet)

**Verdict: FIX THEN SHIP**

**What's good:**
- praise: escapeField is four lines and obviously correct — debuggable at 2 AM.
- praise: one seam test writes a real file and re-opens it; that's the boundary that actually breaks.

**Simplify:**
- suggestion: buildCsv takes an unused `options` param left over from the old config-bag. Delete it — an abstraction with one caller and one config is not architecture.

**Fix before shipping:**
- blocker: empty state — a user with zero workouts exports a headers-only file with no feedback. Show "No workouts to export yet" and skip the share sheet. Empty states are correctness, not polish.

**Live with it:**
- The export is synchronous with a spinner. Fine for now — revisit only if real accounts jank. Explicitly okay.

**Scope drift:**
- None. Column picker and XLSX stayed out, as the pitch demanded.
```

If the code worked and was simple, the verdict would just be **SHIP IT** — the skill forbids inventing problems or requesting comprehensive coverage for an MVP.

---

## `/ship` — get it out the door

**Input:** `/ship CSV export`

`/ship` fights the "one more thing" instinct. It runs the pre-ship checks; if all pass, ship — if one fails, fix _only_ that, no quality spiral. The checks, as a pass/fail list:

```text
Solves the stated problem (data out of the app, not a reporting suite)     PASS
Understandable with no docs (one Export button, native share sheet)        PASS
Happy path works without errors                                            PASS
Empty state handled ("No workouts to export yet")                          PASS  (from review)
Copy is in the user's language, not developer's                            PASS
Tested as a real user, not as the author                                   PASS
```

All green, so it ships — no beta label, no "soon." The launch copy leads with the problem solved, not the technology, and stays under three paragraphs:

```text
## Export your workout history

Your training data is yours. You can now export your full workout history as a spreadsheet — for a coach, a backup, or your own charts.

Open History, tap Export, and share the file anywhere. It opens cleanly in Excel and Google Sheets.
```

No "thrilled to announce," no "AI-powered," no promise of XLSX next version. Celebrate what's there; don't apologize for what's cut. Then the post-ship protocol: watch for real bugs (crashes, data loss) and fix those now; ignore feature requests for 48 hours and wait for patterns, not the first complaint.

---

## `/market-research` — how a brief gets shaped

**Input:** `/market-research evidence for HRV-based readiness scoring in consumer fitness apps`

This skill is evidence-first and Exa-driven. It clarifies the question, runs at least three varied searches (broad, expert, contrarian), deep-fetches the best sources, cross-references — one source is an anecdote, three is evidence — and only then synthesizes. The search strategy is the concrete work:

```text
Search 1 (scientific):  "peer-reviewed study HRV readiness training load athletes 2023 2024 2025"
Search 2 (systematic):  "systematic review heart rate variability guided training outcomes"
Search 3 (contrarian):  "limitations wearable HRV daily readiness score reliability criticism"
```

The synthesized brief follows the skill's own template (numbers below are illustrative of the _shape_, not cited facts):

```text
## Research Question
Does daily HRV meaningfully predict training readiness for consumer fitness users — and where does it fail?

## Key Findings
1. HRV-guided training shows outcome gains over fixed plans in controlled athlete studies [1][2].
2. Single-morning readings are noisy; a rolling baseline (e.g. 7-day) is what the literature relies on [2].
3. Consumer wrist sensors trade accuracy for convenience vs chest straps — directionally useful, not clinical [3].

## Data Points
- Reported effect sizes and baseline windows per study — caveat that samples skew small and athletic.

## Implications for the product
- Ship a rolling-baseline readiness signal, framed as guidance, not a medical claim. Don't over-promise a single-day score.

## Confidence Level
Medium — consistent direction across sources, but small samples and a contrarian reliability critique that must be flagged, not buried.

## Sources
1. [Study title — journal — 2024 — URL]
2. [Systematic review — journal — 2023 — URL]
3. [Sensor-comparison study — journal — 2025 — URL]
```

The rules that keep it honest: prefer recent, peer-reviewed sources; cite every claim with a URL; flag contradictions instead of smoothing them; quantify ("US$6.3B market" beats "large market"); and "I couldn't find reliable data on this" is a valid finding, not a gap to paper over. The brief is saved to `docs/research/[topic-slug].md`.

---

## `/cycle` — the whole loop, orchestrated

**Input:** `/cycle "let users export their workout history as CSV"`

`/cycle` is the conductor: it runs the skills in sequence, writes a durable artifact trail, and pauses only at the two decisions a human genuinely owns — the bet (direction) and the ship. Everything between runs autonomously. The pipeline:

```text
goal → research (parallel subagents) → shape → BET ①  → scope → spec → build+tests → SHIP ②  → review + verify
```

**Phase 0 — Setup.** `ls docs/cycles/`, increment to `07`, create `docs/cycles/07-csv-export/README.md` with status, problem, and "done means the user can export full history as a clean CSV."

**Phase 1 — Research (parallel, no pause).** Up to three investigators in one turn, each scoped: codebase (where History and the data layer live, what's reusable, with file paths), runtime/data (does a share-sheet helper already exist? query/grep to prove it — "doesn't exist" needs double proof), external (CSV-in-Excel encoding gotchas from official docs, respecting the source hierarchy). Synthesized into `research.md`.

**Phase 2 — Shape → CHECKPOINT ①.** Runs `/shape` grounded in the research, writes `pitch.md`, then stops. It presents a 3–5 finding summary plus the full pitch and asks **one batched question**:

```text
CHECKPOINT ① — Bet on the direction
Findings: (1) no existing CSV path; (2) a share-sheet helper already exists — reuse it; (3) Excel needs a BOM + quoted fields.
Open decision: synchronous export with a spinner vs off-thread builder?
  → Recommend synchronous — the 20% version; revisit only if real accounts jank.
Your call: BET / RESHAPE / KILL, and pick the export approach.
```

Direction _always_ passes through the human. Only after the bet does the spec get written.

**Phase 3 — Scope + Spec (no pause of its own).** `/scope` breaks the bet into the three slices (most uncertain first), then `spec.md` translates them to tasks by file path, each carrying its own tests — including the seam test for the file boundary. No throwaway POC here: the research already proved the encoding and the share-sheet reuse with real code and official docs, so a POC would be over-engineering.

**Phase 4 — Build → CHECKPOINT ②.** Implements task by task, `@engineer`-style, iterating until the gate is green — implement → run → fail → fix the cause → repeat, never ending on red. `notes.md` accrues decisions. Then it stops:

```text
CHECKPOINT ② — Ship
Tasks: builder ✓  full-history ✓  button+share ✓
Gate: typecheck + lint + build + test all green.
Diff: +2 files, ~140 lines. No migrations.
Approve to ship? → then /ship, write the changelog fragment, refresh docs, deploy, commit.
```

**Phase 5 — Review + verify.** Prove the new behavior in the real app (export a real account, open the file in Sheets), run `/review` against the spec, mark the cycle `done`.

The trail it leaves — the point of `/cycle` over calling skills by hand:

```text
docs/cycles/07-csv-export/
  README.md      overview, tasks, "done means…"
  research.md    reusable code + Excel-encoding evidence, with paths and URLs
  pitch.md       the shaped bet (problem / appetite / solution / no-gos)
  spec.md        tasks by file path, their tests, deploy order
  notes.md       decisions during the build (why synchronous, the BOM call)
  changelog.md   one line: "Add CSV export of workout history."
```

And because it's a cycle, not an arrow: if the build reveals complexity that breaks the spec, it updates `spec.md` _first_ and — if direction changes — asks; it never improvises past a stale spec or expands scope silently.

---

## The agents — spawn them, they come back with a result

Same discipline as the skills, run autonomously in isolated context. One line and a spawn each:

- **`@shaper`** — raw idea → a full shaped pitch; reads the codebase for what's reusable before proposing anything, and will tell you an idea shouldn't be built. `@shaper "offline workout tracking"`
- **`@product-strategist`** — build / kill / reshape / defer, grounded in the product brief; never "because competitors have it," never "it depends." `@product-strategist "should we add social feed features?"`
- **`@engineer`** — builds a scoped task end-to-end, matches existing patterns, iterates until the build is green, never reports done on red. `@engineer "implement the CSV builder scope"`
- **`@debugger`** — reproduces, hypothesizes, binary-searches to the root cause; never masks with a nil check, says "root cause uncertain" when it is. `@debugger "weekly summary shows 0 workouts for some users"`
- **`@reviewer`** — read-only review for simplicity and blast radius; delivers SHIP IT / FIX THEN SHIP / NEEDS REWORK and never invents problems. `@reviewer "review the CSV export changes"`
- **`@researcher`** — deep Exa research with citations, cross-referenced, contrarian view included; never fabricates a source. `@researcher "evidence for HRV-based readiness scoring"`
- **`@closer`** — pre-ship checklist and launch copy tailored to the release target; fights "one more thing," never delays for polish. `@closer "prepare the release notes for CSV export"`

Agents and skills share the same methodology files — the agent's frontmatter lists the skills it carries — so a `@debugger` runs the exact `/debug` method above, just out of band. Pick the agent when you want the work done without watching it; pick the skill when you want to drive.
