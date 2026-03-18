Habit check-in — log today's habits or view status.

**View today's habits:**
`GET https://tomos-task-api.vercel.app/api/life/habits/check-in` — shows habits due today with completion status and streaks.

Display as a checklist with icons and streak count. Highlight streaks 7+ days.

**Log habits:**
If the user says which habits they've done, batch log them:
`POST https://tomos-task-api.vercel.app/api/life/habits/check-in` with `{ "habits": [{ "id": "...", "completed": true }] }`

If the user just says "log habits" or "habit check", show the checklist first, then ask which ones they've done. Accept shorthand like "all except stretch" or "first 3".

**Create new habit:**
If the user wants to add a new habit:
`POST https://tomos-task-api.vercel.app/api/life/habits` with `{ "title": "...", "frequency": "daily|weekdays|weekends|mon_wed_fri|tue_thu|custom", "category": "health|productivity|family|wellbeing", "icon": "emoji" }`

For custom frequency, ask which days (1=Mon through 7=Sun) and pass as `customDays`.

Tone: encouraging, no guilt on misses. Celebrate streaks. Keep it quick — this should take 30 seconds.
