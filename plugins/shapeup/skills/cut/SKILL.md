---
name: cut
description: "Scope-hammer: when you're over appetite or overwhelmed, this skill helps decide what to cut. Use when things are taking longer than expected."
argument-hint: "[describe what you're building and where you're stuck]"
---

# Cut: Scope-Hammer

You're over budget or overwhelmed. Don't extend the time — reduce the scope. Fixed time, variable scope.

## Process

### 1. List What You Have
What scopes/features are currently planned or in progress?
For each one, classify:
- **Must ship**: Without this, the feature doesn't solve the stated problem
- **Should ship**: Makes it significantly better but isn't the core value
- **Nice to have**: Would be great but the user survives without it

### 2. Kill "Nice to Have" Immediately
No discussion. No "but it's almost done." If it's nice to have, cut it.

### 3. Challenge "Should Ship"
For each "should ship" item, ask:
- **"What's the simpler version?"** — Not "remove it" but "what's the 20% effort version?"
- **"What if we just... didn't?"** — Compare against what the user has TODAY (maybe nothing). Even a rough version is infinitely better than nothing.
- **"Will anyone notice?"** — If you have to explain why it's valuable, it's not valuable enough.

### 4. Protect "Must Ship"
These survive. But even here, ask: "Is there a simpler implementation?"
- Can you hardcode something instead of making it dynamic?
- Can you use a simple list instead of a search?
- Can you show text instead of a chart?
- Can you skip the animation?
- Can you use a system component instead of a custom one?

## Output Format

```
## CUT PLAN: [Feature Name]

**Appetite remaining:** [time left]

**KEEP (must ship):**
- [Scope/feature] — [why it's essential]

**SIMPLIFY (reduce effort):**
- [Scope/feature] → [simpler version]

**CUT (remove entirely):**
- [Scope/feature] — [why it's safe to cut]

**Revised scope fits appetite:** [Yes/No]
**If No → Circuit breaker:** [This needs reshaping. Go back to /shape.]
```

## Decision Shortcuts

| Situation | Default action |
|-----------|---------------|
| "It's almost done" | If it's not done, it's not done. Cut it. |
| "Users expect this" | Which user? One real person or your imagination? |
| "It'll only take an hour" | No it won't. Cut it. |
| "We need it for parity with X" | You're not X. Underdo the competition. |
| "But the data model supports it" | Data models are cheap. Ship what's needed now. |
| "The design has it" | Designs are aspirations. Ship what fits the appetite. |

## Circuit Breaker

If after cutting everything non-essential you STILL can't fit the appetite:
- **STOP building.**
- The pitch needs reshaping. The problem was scoped wrong.
- Go back to `/shape` with what you learned.
- This is not failure — it's the system working. Better to reshape than to ship half-broken.

## Rules

- Never extend the deadline. Always cut scope.
- "Good enough" beats "perfect" every single time.
- The user doesn't know what you cut. They only see what you shipped.
- Build half a product, not a half-assed product.
- Every feature you cut is a feature you don't have to maintain, test, document, or debug.
