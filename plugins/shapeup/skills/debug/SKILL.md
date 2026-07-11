---
name: debug
description: "Systematic debugging using the scientific method. Use when something is broken and you need to find the root cause, not just make symptoms disappear."
argument-hint: "[describe the bug: what you expected vs what happened]"
---

# Debug: Scientific Method for Bugs

Debugging is the scientific method applied to code. Observe → Hypothesize → Predict → Test → Update. Never change code randomly hoping something works.

## Process

### 1. Reproduce First, Always

A bug you can't reliably trigger is a bug you can't systematically investigate.

- Find the minimum inputs and conditions
- Spend time here before anything else
- If you can't reproduce it, you can't fix it. Gather more information.

### 2. Describe the Gap

Write one sentence:

- **Expected:** [what should happen]
- **Actual:** [what happens instead]
- **When:** [specific conditions/inputs]

This forces clarity. If you can't write this, you don't understand the bug yet.

### 3. List Hypotheses

Write down 3-5 possible causes. For each one:

- What evidence would CONFIRM this hypothesis?
- What evidence would DISPROVE it?
- Prioritize experiments that disprove — elimination is faster than confirmation.

### 4. Binary Search the Problem

Don't read the entire codebase. Narrow the search space:

- Divide the execution path in half
- Is the state correct at the midpoint?
- If yes → bug is after. If no → bug is before.
- Repeat until you've isolated the faulty section.

Tools:

- Print/log statements at boundaries
- Breakpoints at key state transitions
- Check inputs and outputs of each function in the chain

### 5. Find the Root Cause

A symptom is not a cause.

- "500 error" = symptom
- "Nil pointer because optional wasn't unwrapped after async call" = cause

Use the Five Whys:

1. Why did the screen crash? → Nil pointer
2. Why was it nil? → Async call returned before data loaded
3. Why wasn't that handled? → Missing await/guard
4. Why was the guard missing? → Pattern wasn't followed here
5. Root cause: async pattern inconsistency

### 6. Fix and Verify

- **Change one thing at a time.** Multiple simultaneous changes = impossible to determine cause.
- **The fix should address the ROOT CAUSE, not the symptom.** Don't add nil checks to mask a data flow problem.
- **Verify the fix resolves the original reproduction case.**
- **Check for similar patterns** elsewhere — if this bug exists here, does it exist in analogous code?

### 7. Document the Fix

One short note:

```
## Bug: [symptom]
**Root cause:** [what was actually wrong]
**Fix:** [what was changed]
**Prevents recurrence:** [test added or pattern established]
```

## Investigating Production Data

When the bug lives in real production state — not code you can run locally — the scientific method still holds, but your "experiments" are queries against the live system. Extra rules, because a wrong query yields a _confident_ wrong conclusion:

- **Query the source of truth directly.** Not a dashboard, convenience layer, or derived view that may filter or diverge from the raw data. Those have produced wrong numbers before.
- **Never assume the meaning of a status or field.** Before filtering on `status = 'X'`, run `SELECT field, COUNT(*) … GROUP BY field` and read the real values and their distribution. The obvious-looking status is often transitional or rare.
- **Verify the premise before you conclude.** Before claiming "X doesn't exist", "the table is empty", or "N rows are affected", run a query that _proves_ it: does the JOIN drop rows? is the date window right? is the field really never populated? Present the verification numbers next to the conclusion.
- **Sanity-check the aggregate.** Reconcile your total against a known baseline (e.g. total rows for the period) before presenting. A number that doesn't reconcile = investigate, don't ship.
- **"Not implemented" needs double proof.** Grep the code AND query production. A field that looks missing is often already there under a different name.

## Output Format

```
## DEBUG: [symptom description]

**Reproduction:** [exact steps]

**Hypotheses:**
1. [Hypothesis] — [status: testing/confirmed/eliminated]
2. [Hypothesis] — [status]
3. [Hypothesis] — [status]

**Investigation:**
[What you checked, what you found at each step]

**Root cause:** [the actual problem]

**Fix:** [what to change]

**Similar patterns to check:** [other places this bug might exist]
```

## Rules

- NEVER change code randomly. Every change should test a hypothesis.
- NEVER add a nil check / try-catch to "fix" a bug without understanding WHY the value is nil / WHY it throws.
- A fix that makes symptoms disappear but doesn't address root cause = a new bug waiting to happen.
- If you've been stuck for 15+ minutes on one hypothesis, step back. List your assumptions. One of them is wrong.
- The bug is usually simpler than you think. Check the obvious things first: typos, wrong variable, off-by-one, missing await.
- "It works on my machine" means the reproduction conditions are incomplete, not that the bug doesn't exist.
- After fixing, ask: "What process/pattern/test would have caught this earlier?" That's the real fix.
