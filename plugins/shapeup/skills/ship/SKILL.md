---
name: ship
description: "Pre-ship checklist and launch copy. Fights the 'one more thing' instinct. Use when you're done building but haven't shipped yet."
argument-hint: "[feature name or 'check current changes']"
---

# Ship: Get It Out the Door

The hardest part of software is not building it. It's letting go. This skill fights the "one more thing" instinct and gets things shipped.

## Pre-Ship Checklist

Run through these. If all pass → ship. If any fail → fix ONLY that. Don't start a quality spiral.

- [ ] Does it solve the stated problem? (Not a different, bigger problem)
- [ ] Can a new user understand it without documentation?
- [ ] Does the happy path work without errors?
- [ ] Are empty states handled? (First-time user sees something helpful)
- [ ] Is the copy in the user's language, not developer language?
- [ ] Have you tested as a real user, not as the person who built it?

## Handle "One More Thing"

When you think "but I should also add..."
1. **Is that in the pitch/scope?** → If no, it's a new pitch for later.
2. **Would you delay shipping a week for this?** → Usually no.
3. **What happens if you ship without it?** → Usually nothing bad.
4. **Write it down for later.** Ship what you have.

## Launch Copy Template

Write the announcement. Lead with the problem solved, not the technology used.

```
## [Feature Name]

[One sentence: what problem this solves for whom.]

[One sentence: how it works — the simplest explanation.]

[Optional: one concrete example or screenshot.]
```

### Writing Rules
- 3 paragraphs maximum
- No buzzwords. No "excited to announce." No "we've been working hard."
- No "leveraging AI" or "powered by machine learning"
- Show, don't tell. One screenshot > three paragraphs.
- Don't apologize for what's missing. Celebrate what's there.
- Don't promise features for the next version.
- Never use the word "soon."

### Good vs Bad

**Good:** "You can now track your workouts and see your progress over time. Open the app, tap 'Start Workout,' and go."

**Bad:** "We're thrilled to announce our revolutionary AI-powered workout tracking system, leveraging cutting-edge machine learning algorithms to provide personalized fitness insights."

## Post-Ship Protocol

- Monitor for real bugs (crashes, data loss). Fix those immediately.
- Ignore feature requests for 48 hours. Let the dust settle.
- Don't react to the first complaint. Wait for patterns.
- Plan the follow-up: what did users actually need that you cut? Shape that for the next cycle.

## Rules

- The first version should feel too simple. That's correct.
- Ship on Monday. Give yourself the week for follow-up.
- No "beta" labels. If it's not ready, don't ship. If it's ready, own it.
- Don't delay for polish. Polish what's already shipped based on real feedback.
- If you're writing more than 300 words for a launch announcement, cut it.
