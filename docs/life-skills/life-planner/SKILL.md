---
name: life-planner
description: >
  Build a prioritised weekly personal plan for Tom, integrating calendar, tasks, habits, and energy level. Use this skill whenever Tom types /planweek, asks "plan my week", "what should I focus on this week", "weekly priorities", "build me a week", "what matters this week", or describes needing to get organised for the week ahead. Also trigger when Tom mentions energy level alongside personal planning context, describes a shift between kid week and non-kid week, or says "I'm all over the place". This is the primary planning skill for TomOS: Life — always use it rather than giving generic productivity advice.
---

# Life Planner — Weekly Plan Generator

Build a concrete, ADHD-friendly weekly plan. Not a wishlist — a short, prioritised set of things that actually matter this week. One page. No overwhelm.

## Required Inputs

Collect these before generating. If Tom doesn't provide all upfront, ask — but one round of questions max.

| Input | Format | Notes |
|-------|--------|-------|
| **Energy level** | 1–5 | 1 = survival mode, 3 = functional, 5 = locked in |
| **Kid week?** | Yes/No | Changes available time, priority weighting |
| **Constraints** | Free text | "Work event Thursday", "dentist Monday arvo" |

If Tom just says "plan my week, energy 3" — use sensible defaults for the rest.
## Data Sources (pull before generating)

1. **`GET https://tomos-task-api.vercel.app/api/life/plans/current`** — check if plan exists
2. **Google Calendar** — pull this week's events via GCal MCP (`gcal_list_events` Mon–Sun)
3. **`GET https://tomos-task-api.vercel.app/api/life/today`** — current state snapshot
4. **Open tasks** — included in today endpoint, or fetch more if needed
5. **Active goals** — reference if set, don't force alignment

## Energy-to-Capacity Mapping

| Energy | Max priorities | Planning depth |
|--------|---------------|----------------|
| 1 | 1–2 | Survival items only |
| 2 | 2–3 | Basic maintenance |
| 3 | 3–4 | Balanced across domains |
| 4 | 4–5 | Can include stretch goals |
| 5 | 5 | Full capacity |

## Kid Week Adjustments

When kids are home: morning/evening windows shrink, priorities shift toward family/household/logistics, work compresses into school hours, lower the bar on personal projects without guilt.
## Output Format

```
## Week Plan: [Mon DD — Sun DD Month]
**Energy:** [X/5] | **Kid week:** [Yes/No] | **Top priorities:** [N]

### This Week's Priorities
1. 🎯 [Priority — specific and actionable]
2. 🎯 [Priority]
3. 🎯 [Priority]

### Daily Shape
| Day | Calendar | Focus | Notes |
|-----|----------|-------|-------|
| Mon | [Events] | [Focus area] | [One-liner] |
| ... | | | |

### If Everything Goes Sideways
**Minimum viable week:** [The 1-2 things that still count as a win]
```

## After Generating

1. **Save:** `POST /api/life/plans` or `PATCH` with priorities, intentions, energyLevel, kidWeek
2. Offer to create Google Calendar focus blocks (with permission)
3. Mention `/today` for daily check-ins and `/review` at end of week

## Key Rules

1. **3-5 priorities max.** At energy 1-2, even 3 might be too many.
2. **Priorities must be specific and completable.** Not "work on fitness" — "Run 3x including Saturday long run".
3. **Don't duplicate training planning.** Say "Training: per coach plan" and move on.
4. **Calendar is king.** Don't assign big priorities on wall-to-wall meeting days.
5. **Minimum viable week is non-negotiable.** Always state the floor.
6. **Kid week ≠ write-off week.** Different week, not lesser week.
