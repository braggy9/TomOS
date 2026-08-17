# Strava Sync Operations

Operational reference for the Strava data path used by FitnessOS and Training
Radar.

## Routes

| Route | Method | Purpose | Authentication |
| --- | --- | --- | --- |
| `/api/gym/sync/strava` | GET | Strava webhook subscription challenge | `STRAVA_VERIFY_TOKEN` |
| `/api/gym/sync/strava` | POST | Accept and process activity-created events | Strava webhook delivery |
| `/api/gym/sync/strava/manual` | GET | Idempotent 14-day cron catch-up | Bearer `CRON_SECRET` |
| `/api/gym/sync/strava/manual` | POST | Manual catch-up, default 90 days | Bearer `CRON_SECRET` |
| `/api/gym/sync/strava/status` | GET | Current sync telemetry and latest run date | Protected by `TOMOS_TRAINING_READ_TOKEN` |

Manual sync accepts `?days=N`; values are validated and bounded by
`lib/fitness/strava-sync-request.ts`. Do not place `CRON_SECRET` in the query
string.

## Webhook Behaviour

The webhook accepts only a valid activity event with a positive integer object
ID. Events other than newly created activities are acknowledged and ignored.

For new activities the route returns immediately, then processes the activity
through Vercel `waitUntil`:

1. Record the sync attempt.
2. Obtain or refresh the Strava access token.
3. Fetch the full activity.
4. Upsert runs into `running_sync` or supported non-run activities into
   `activities`.
5. Attempt to link a run to an eligible planned session.
6. Record success or failure telemetry.

Telemetry recording is best-effort and must not make an otherwise successful
sync fail.

## Health Model

`integration_sync_status` stores one row per provider:

```text
provider
lastAttemptAt
lastSuccessAt
lastError
lastResult
```

For Strava, the row ID and provider are both `strava`. The status endpoint also
queries the latest `running_sync` record and returns `latestActivityAt`.

The integration is stale when `lastSuccessAt` is absent or more than 36 hours
old. A current sync with an old `latestActivityAt` means the integration checked
successfully but found no newer run. Training Radar must preserve that
distinction.

## Catch-Up

The catch-up is safe to replay because activities are upserted by external
Strava ID.

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://tomos-task-api.vercel.app/api/gym/sync/strava/manual?days=14"
```

After a catch-up, verify both the result and the independent status route:

```bash
curl -fsS https://tomos-task-api.vercel.app/api/gym/sync/strava/status \
  -H "Authorization: Bearer $TOMOS_TRAINING_READ_TOKEN"
```

Do not call the catch-up merely because `latestActivityAt` is old. First check
whether Tom actually completed a newer Strava activity.

## Database Migration

The telemetry table was introduced by migration
`20260817000000_add_integration_sync_status`.

During the 17 August 2026 production release, older schema objects were present
but four historical migrations were absent from Prisma's ledger. Their tables,
columns, indexes, and foreign keys were audited before those migrations were
resolved as applied. The telemetry migration then deployed normally.

Do not repeat `prisma migrate resolve` from this note alone. Re-audit the live
schema before resolving any future migration drift.

## Verification Snapshot: 17 August 2026

- A protected 14-day catch-up completed successfully.
- Four Strava runs were found and upserted; the latest was dated 14 August.
- `lastSuccessAt` was recorded and the status endpoint changed from stale to
  current.
- Focused sync request and telemetry tests passed, 8 tests total.
- Prisma validation and the production Vercel build passed.

This is historical release evidence. Query the status endpoint for current
health.

## Failure Triage

1. Check `/api/gym/sync/strava/status` for `lastError`, `lastAttemptAt`, and
   `lastSuccessAt`.
2. Confirm whether `latestActivityAt` is expected from the user's real Strava
   history.
3. Inspect production function logs for webhook, token, or Strava API errors.
4. Run one protected 14-day catch-up if deliveries were missed.
5. Recheck status and the running activities endpoint.

Never print or commit `CRON_SECRET`, Strava tokens, client secrets, or webhook
verification tokens.
