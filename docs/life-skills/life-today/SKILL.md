---
name: life-today
description: >
  Daily personal briefing pulling from calendar, habits, tasks, training, and weekly plan. Use this skill whenever Tom types /today (in a personal/life context, not training), asks "what's on today", "what should I focus on", "morning briefing", "daily check-in", opens a new chat without a specific request, or says "what's the plan today". Also trigger on ambiguous morning messages like "morning", "hey", or "what's up" when no other context is provided — this is the default opening move for TomOS: Life. Do NOT trigger if the context is clearly training-specific (use today-briefing from Training instead) or work-specific (use Publicis catchup). If ambiguous, default to this skill as it includes training and work context in its aggregated view.
---

# Life Today — Daily Briefing

Fast, one-screen daily briefing. Tom opens a chat, gets the day at a glance, moves on.

## Data Source

**`GET https://tomos-task-api.vercel.app/api/life/today`** returns:- Today's habits + completion status
- Unchecked shopping items count
- Current weekly plan priorities
- Top 5 open tasks (by priority/due)
- Last journal mood + energy
- Today's training prescription (if any)

Supplement with: **Google Calendar** (`gcal_list_events` for today) and **Weather** if relevant.

## Output Format

```
## 📅 [Day, DD Month YYYY]
**Mood:** [emoji] | **Energy:** [level] | **Kid week:** [Yes/No]

### Calendar
[Compact event list or "Clear day"]

### Top 3 Today
1. [Most important — from priorities or urgent tasks]
2. [Second]
3. [Third]

### Habits Due
[⬜/✅ list with X of Y completed]

### Quick Stats
🛒 [N] shopping | 📝 [N] tasks | 🏃 [Training status]
```