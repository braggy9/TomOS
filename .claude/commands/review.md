End of week review — how'd my week go?

Steps:
1. `GET https://tomos-task-api.vercel.app/api/life/plans/current` — this week's plan + priorities
2. `GET https://tomos-task-api.vercel.app/api/life/habits/check-in` — today's habits status
3. `GET https://tomos-task-api.vercel.app/api/life/habits?status=active` — habits with recent logs and streak data
4. `GET https://tomos-task-api.vercel.app/api/journal/insights` — mood/energy trends
5. `GET https://tomos-task-api.vercel.app/api/gym/coach/summary?days=7` — training summary

Present:
- Priority completion: which priorities were done vs not
- Habit consistency: completion rate this week, streak highlights, any broken streaks
- Mood/energy pattern from journal
- Training summary (km run, sessions)

Then ask 2-3 brief reflection questions:
- What worked well this week?
- What got in the way?
- One thing to carry forward?

After Tom answers, save the reflection:
`PATCH https://tomos-task-api.vercel.app/api/life/plans/[id]` with:
- `reflection`: Tom's answers formatted as text
- `satisfactionScore`: ask Tom to rate 1-5
- `status`: "completed"

Update priority statuses based on what Tom reports as done.

Tone: supportive, no guilt. Celebrate wins. Be honest about misses but frame them constructively.
