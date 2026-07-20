---
name: chat-status
description: >
  Chat health check and handoff readiness protocol. Use this skill when Tom says /status, "how much context do we have left", "are we running low", "should we wrap up", or "what's unsynced". Also trigger proactively when the conversation has been compacted more than once, or when a large amount of work has been done since the last /notionLD sync. This skill helps Tom decide whether to continue in this chat or start a new one.
---

# Chat Status

Quick health check on the current chat session. Answers: "Should I keep going here or start a new chat?"

## When to Run

- Tom types `/status`
- Tom asks about context window, chat limits, or whether to wrap up
- Claude notices the conversation has been compacted (check for transcript summary at top of context)
- A lot of unsynced work has accumulated since the last `/notionLD` push
- Proactively after 10+ substantive exchanges without a sync

## What to Check

### 1. Compaction Status
- Has this conversation been compacted? (Look for `[NOTE: This conversation was successfully compacted...]` at top of context)
- How many compactions? First compaction = still have runway. Second compaction = wrap up soon.
- If compacted: is the transcript file accessible at the path noted?

### 2. Unsynced State
List everything discussed or decided since the last `/notionLD` push that hasn't been written to the Notion living doc:

- Sessions logged but not in Notion
- Plan adjustments made
- Race calendar changes
- Decisions made
- New information gathered (coach contact, race research, etc.)

### 3. Active Context
What's currently "in memory" for this chat that would be lost in a new chat:

- Current week's plan (if generated this session)
- Session data discussed but not formally logged
- Ongoing threads (e.g., "we were in the middle of researching X")
- Promises made ("I'll check back on Y")

### 4. Living Doc Currency
When was the last `/notionLD` sync? Is the living doc current?

## Output Format

```
## Chat Status

### Context Health
**Compactions:** [0 / 1 / 2+]
**Estimated runway:** [Plenty / Moderate / Low — wrap up soon]
**Last sync to Notion:** [Date/time or "this session" or "not yet"]

### Unsynced Items
- [List of decisions, sessions, changes not yet in the living doc]
- [Or "All synced ✓" if nothing pending]

### Recommendation
[One of:]
- ✅ **Keep going.** Plenty of context. No urgency to wrap up.
- ⚠️ **Sync soon.** Moderate context pressure. Do a /notionLD push to bank progress.
- 🔴 **Wrap up.** Context is getting tight. Recommend: final /notionLD sync, then new chat + /catchup.

### If Wrapping Up — Checklist
- [ ] Final /notionLD push (I'll do this now if you say yes)
- [ ] Set living doc Status to "Maxed out" if chat is done
- [ ] Note anything the next chat needs that ISN'T in the living doc
```

## Key Principles

1. **Don't panic.** One compaction is normal. Two means start planning the handoff.
2. **The living doc is the safety net.** If it's current, losing this chat is painless. If it's stale, that's the risk.
3. **Better to sync too often than too late.** A `/notionLD` push takes 30 seconds. Losing unsynced decisions takes longer to reconstruct.
4. **Be honest about uncertainty.** Claude can't see a token counter. Compaction count + conversation length are the best proxy signals.
5. **Don't make Tom do the work.** If the recommendation is to wrap up, offer to do the final sync immediately.
