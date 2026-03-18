Shopping list manager — add, view, or clear items.

Based on what the user says, do one of:

**View list:**
`GET https://tomos-task-api.vercel.app/api/life/shopping` — show items grouped by category, unchecked first. Show quantity if set.

**Add items (natural language):**
`POST https://tomos-task-api.vercel.app/api/life/shopping/parse` with `{ "text": "<user's text>" }` — Claude Haiku parses the text into structured items with name, quantity, and category. Confirm what was added.

**Check off items:**
`POST https://tomos-task-api.vercel.app/api/life/shopping/check` with `{ "ids": ["id1", "id2"] }` — toggle items as checked.

**Clear checked:**
`POST https://tomos-task-api.vercel.app/api/life/shopping/clear` with `{}` — delete all checked items. Confirm count cleared.

**Remove specific item:**
`DELETE https://tomos-task-api.vercel.app/api/life/shopping/[id]`

If the user just says "shopping list" or "going to Woolies", show the current unchecked list grouped by category (produce, dairy, meat, pantry, household, other) for easy aisle navigation.

Keep responses brief. This is a utility command, not a conversation.
