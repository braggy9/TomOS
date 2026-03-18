Weekly plan generator — plan my week.

Ask for (if not provided): energy level (1-5) and whether it's a kid week (y/n). If not provided, make reasonable assumptions.

Steps:
1. `GET https://tomos-task-api.vercel.app/api/life/plans/current` — check if plan exists
2. `GET https://tomos-task-api.vercel.app/api/life/today` — current state snapshot
3. `GET https://tomos-task-api.vercel.app/api/life/goals?status=active` — active goals for context
4. `GET https://tomos-task-api.vercel.app/api/tasks?status=todo&limit=20` — open tasks (if this endpoint exists, otherwise use /api/all-tasks)
5. Generate 3-5 prioritised weekly priorities based on goals, open tasks, and energy level
6. Generate daily focus areas (Mon-Sun) considering kid week constraints
7. Save via `PATCH https://tomos-task-api.vercel.app/api/life/plans/[id]` with:
   - `energyLevel`: 1-5
   - `kidWeek`: boolean
   - `priorities`: [{title, category, status: "todo"}]
   - `intentions`: [{day, focus, notes}]
   - `status`: "active"

Output: Clean daily schedule with top priorities. Keep it realistic for ADHD — fewer items, clear focus.

Kid week constraints: mornings are rush, evenings are bedtime routine. Deep work only during school hours (9-3). Non-kid week: more flexibility for long sessions, evening work, social.
