---
name: shape
description: "Take a raw idea or feature request and shape it into a buildable pitch with fixed appetite. Use when you have a new idea, vague requirement, or feature request that needs scoping."
argument-hint: "[idea or problem description]"
---

# Shape: Idea → Pitch

Turn raw ideas into shaped pitches with fixed appetite. Based on Shape Up by Ryan Singer.

## Process

### 1. Understand the Problem (not the solution)

Ask yourself:
- What is the actual problem? Who has it? When does it hurt?
- If the user described a solution, what problem does it solve?
- "If we do nothing, what happens?" — if the answer is "nothing much," stop here.

### 2. Set the Appetite

Appetite = how much time this is WORTH, not how long it will TAKE.

| Size | Solo dev time | Use for |
|------|--------------|---------|
| Micro | 1-2 hours | Quick fix, small tweak |
| Small | Half day - 1 day | Single-scope feature |
| Medium | 2-3 days | Multi-scope feature |
| Large | 1-2 weeks | Significant new capability |

If the user says "as long as it takes" — push back. Everything has a budget.
The appetite is a creative constraint. It tells you how much to design.

### 3. Find the Elements

Sketch the solution at the RIGHT level of abstraction:
- **Breadboard**: List key places (screens/states), affordances (buttons/fields/actions), connections between them
- **Fat marker**: Rough shapes only. If you can't describe it in 3-5 bullet points, you're going too detailed.
- Name the major pieces. 3-5 elements maximum.

### 4. Identify Rabbit Holes

What looks simple but isn't? What could blow up the appetite?
- For each risk: solve it now (in the pitch) or declare it out of bounds
- If you can't de-risk it, the pitch isn't ready

### 5. Declare No-Gos

What is explicitly NOT included? Be specific.
"We are NOT building X. We are NOT handling edge case Y."

## Output Format

```
## PITCH: [Name]

**Problem**
[1-3 sentences. What hurts and for whom.]

**Appetite**
[Size + time budget. e.g., "Small: 1 day"]

**Solution**
[Named elements, breadboard-level. NOT detailed specs.]
- Element 1: [description]
- Element 2: [description]
- Element 3: [description]

**Rabbit Holes**
- [Risk] → [Mitigation or "out of scope"]

**No-Gos**
- [Thing we're NOT building]
- [Edge case we're NOT handling]
```

## Enforcement Rules

- NEVER stretch the appetite. Cut scope instead. Fixed time, variable scope.
- NEVER output a task list, ticket list, or backlog. Output a pitch.
- If someone asks to "just add a quick feature" — shape it or reject it. Nothing is quick.
- If the solution description exceeds 10 bullet points, you're speccing, not shaping. Go higher level.
- Say "no" more than "yes." Default answer to new scope is no.
- Watch for EPICYCLES — solutions that add complexity to patch complexity. Call them out: "This is an epicycle. The real fix is simpler."
- If an idea can't fit the appetite, don't add time — remove features.
- If $ARGUMENTS is vague, ask clarifying questions about the PROBLEM before shaping.
