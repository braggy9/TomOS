# CLAUDE.md — TomOS

## What This Repo Is

TomOS API backend — Neon Postgres database, Prisma ORM, API routes for matters, journal, training, recovery, and life domains. The data layer that powers Command Tower dashboard and Claude MCP tools.

**Owner:** Tom Bragg (@braggy9)
**Related repos:** braggy9/tomos-command-tower (skills + RULES.md), braggy9/tomos-web (monorepo — dashboard, MCP server), braggy9/mcp-bridges (bridges)

## Mandatory Rules

**Read RULES.md in the tomos-command-tower repo before doing anything.** Cross-project rules on uncertainty, anti-flattening, correction propagation, and trust recovery apply here. Key points:

- **Uncertainty:** If you can't verify a fact about this codebase (schema state, endpoint behaviour, env vars), check — don't guess.
- **Anti-flattening:** Operational data has history. Don't simplify schema or data migrations without understanding why fields exist.
- **Correction propagation:** When corrected, carry the fix across the whole PR — not just the file flagged.
- **No process theatre:** Execute, then explain.

Full rules: https://github.com/braggy9/tomos-command-tower/blob/main/RULES.md

## Key Technical Context

- **Database:** Neon Postgres (connected via `mcp.neon.tech/mcp`)
- **ORM:** Prisma
- **Deploy:** Vercel
- **API patterns:** REST, JSON responses. Some endpoints still return HTML (known bugs — check before assuming JSON)
- **Todoist integration:** REST API v1 only (v2 returns 410). Priority inverted: 4=p1, 1=p4
- **Auth:** Various — service account for Google Calendar, OAuth for Todoist (expires overnight), API tokens for Strava

## Conventions

- Australian English
- Conventional commits
- No placeholder content
- Test endpoints return JSON before marking them working
