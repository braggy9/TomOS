Daily focus briefing — what's my day look like?

1. Call `GET https://tomos-task-api.vercel.app/api/life/today` to get the aggregated snapshot
2. Present a concise daily briefing with:
   - Today's date and day of week
   - Habits due today + completion status (show icons, highlight streaks 7+)
   - Weekly plan priorities (if set) with status
   - Top tasks by priority/due
   - Shopping list count (if any items)
   - Last journal mood/energy
   - Training prescription (if any)
3. Keep it to one screen — no scroll. Use compact formatting.
4. If the user asks follow-up questions, use the relevant Life API endpoints to answer or take action.

Response style: concise, actionable, no fluff. Use the data — don't make things up.
