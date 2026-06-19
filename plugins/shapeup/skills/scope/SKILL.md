---
name: scope
description: "Break a shaped pitch into buildable scopes — independent slices of work that each deliver value. Use after betting on a pitch, before starting to build."
argument-hint: "[paste a shaped pitch or describe the feature to scope]"
---

# Scope: Break Work Into Buildable Slices

Map scopes, not tasks. Each scope is an independent slice that delivers visible value when done.

## What Is a Scope?

A scope is NOT a task. It's a vertical slice that mixes design + code + testing.

| Scope (good) | Task list (bad) |
|--------------|----------------|
| "Record a workout" | "Create model", "Build UI", "Write tests" |
| "View weekly summary" | "Design screen", "Add API", "Style components" |
| "Send notification" | "Research push APIs", "Implement backend", "Frontend handler" |

A scope = when it's done, something NEW works for the user.

## Process

### 1. Read the Pitch
Absorb: problem, appetite, solution elements, rabbit holes, no-gos.
The pitch is direction, not destination. You decide implementation.

### 2. Identify 3-5 Scopes
Each scope must be:
- **Independent**: Can be built and tested without the others
- **Valuable**: When done, the user gains something they didn't have
- **Sized to fit**: Each scope fits in roughly (appetite ÷ number of scopes)

### 3. Order by Uncertainty
Put the MOST uncertain or novel scope first. Do the scary thing early.
- If the hardest part is figuring out the data model → that scope first
- If the hardest part is the UI interaction → that scope first
- If nothing feels uncertain → start with whatever delivers the most value

### 4. Define "Done" for Each Scope
One sentence: what works when this scope is complete?

## Output Format

```
## SCOPES: [Pitch Name]

**Appetite:** [Time budget from pitch]

### Scope 1: [Name] ← START HERE
**Done when:** [One sentence — what works]
**Key elements:** [2-3 bullet points]
**Uncertainty:** [High/Medium/Low] — [why]

### Scope 2: [Name]
**Done when:** [One sentence]
**Key elements:** [2-3 bullet points]
**Uncertainty:** [High/Medium/Low] — [why]

### Scope 3: [Name]
**Done when:** [One sentence]
**Key elements:** [2-3 bullet points]
**Uncertainty:** [High/Medium/Low] — [why]

**Appetite check:** [Total time budget] → [rough allocation per scope]

**Won't do (from pitch no-gos):**
- [Reminder of what's excluded]
```

## Rules

- Maximum 5 scopes. If you need more, the pitch is too big — go back to /shape.
- Never create discipline-based scopes ("Design scope", "Backend scope"). Every scope mixes disciplines.
- Each scope should be completable in 1 session (for a solo dev). If not, it's too big — split it.
- If a scope depends on another scope being done first, redefine them so they're independent. Or merge them.
- Include the no-gos from the pitch as a reminder. Scope creep starts when people forget what's excluded.
