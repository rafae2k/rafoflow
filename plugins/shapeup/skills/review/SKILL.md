---
name: review
description: "Code review focused on simplicity, blast radius, and less software. Use after building to check quality before shipping."
argument-hint: "[file path, git diff, or 'review recent changes']"
---

# Review: Less Software, More Quality

Review code like a senior engineer who's tired of clever. Find where things got more complex than the problem required and push toward simplicity.

## Review Priority Order

Review in this order. Stop going deeper once you find a blocker.

### Level 1: Architecture (does this belong here?)
- Does this change fit the existing patterns in the codebase?
- Does it introduce a new pattern when an existing one would work?
- Is the file in the right place per project structure?

### Level 2: Blast Radius (what breaks when things go wrong?)
- What happens when the external service is down?
- What happens when input is empty/nil/malformed?
- What happens when two things happen simultaneously?
- Authentication, data persistence, payments = HIGH blast radius → extra scrutiny

### Level 3: Simplicity (less software)
- Can any code be deleted without affecting the user?
- Are there abstractions with only one concrete implementation? → Remove them
- Are there config options that could be hardcoded decisions? → Decide for the user
- Is there a simpler way to do this?
- Are there dependencies that could be eliminated?

### Level 4: Correctness
- Does the happy path work?
- Are empty states handled? (No data, first run, no permission)
- Are errors handled without crashing or confusing the user?
- Does it match the original pitch/requirement?

### Level 5: Quality (only if levels 1-4 pass)
- Is the naming clear? Could someone debug this at 2 AM without context?
- Dead code, unused imports, commented-out blocks? → Delete them
- Are there TODO comments that should be done now or removed?

## Output Format

```
## REVIEW: [what was reviewed]

**Verdict: [SHIP IT / FIX THEN SHIP / NEEDS REWORK]**

**What's good:**
- [Specific praise — what works well]

**Simplify:**
- [Where to reduce complexity, delete code, cut abstractions]

**Fix before shipping:** (only if verdict is FIX THEN SHIP)
- [Critical issues only — things that break user experience]

**Live with it:**
- [Imperfections that are fine for now — explicitly saying "this is okay"]

**Scope drift:** (if applicable)
- [Anything built that wasn't asked for]
```

## Rules

- If you find more than 3 critical issues, list the 3 worst. Fix those first.
- If code works and is simple, say "ship it" even if it's not how you'd write it. Style ≠ substance.
- NEVER suggest adding abstractions "for the future." The future will tell us what it needs.
- NEVER block a ship for cosmetic issues.
- NEVER suggest rewriting things that work.
- NEVER request comprehensive test coverage for an MVP.
- Don't add "TODO: refactor" comments. Either fix it or accept it.
- Automate style enforcement with linters. Style should never reach human review.
- Label comments: `blocker:`, `suggestion:`, `nit:`, `praise:`. Never block on nits.
- The question is always: "Can someone debug this at 2 AM without Slacking the author?"
