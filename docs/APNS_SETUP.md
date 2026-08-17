# APNs Push Notification Setup

This document describes the general TomOS Apple Push Notification service (APNs)
broadcaster hosted by the `tomos-task-api` Vercel project.

It is separate from the `tomos-nag` Cloudflare Worker and iPhone app. Both use
the same Apple developer team, APNs authentication key, and bundle topic, but
they have separate device registries and notification logic.

## Current production state

Verified 17 August 2026:

- Backend: `https://tomos-task-api.vercel.app`
- APNs topic / app bundle ID: `com.tomos.app`
- Apple authentication: token-based ES256 JWT using a base64-encoded `.p8` key
- Device registry: Neon Postgres table `device_tokens`
- Active registrations: one macOS sandbox token
- Inactive registrations: one iOS token
- APNs host: sandbox (`api.sandbox.push.apple.com`)

The Vercel project is currently configured with `APNS_ENVIRONMENT=development`.
That is correct for the active development-signed macOS token. Do not switch it
to `production` until the intended app is distributed with a production
`aps-environment` entitlement and has re-registered a production token.

## Architecture

```text
TomOS iOS/macOS app
  -> POST /api/register-device
  -> Neon Postgres device_tokens

Vercel cron or authenticated internal caller
  -> POST /api/send-push
  -> Apple APNs over HTTP/2
  -> every active registered TomOS device
```

The send route signs a short-lived APNs JWT, broadcasts the alert sequentially
to active registrations, and deactivates tokens when Apple returns HTTP 410
(`Unregistered`). The JWT is cached for up to 50 minutes.

## Environment variables

Configure these on the `tomos-task-api` Vercel project:

| Variable | Purpose |
|---|---|
| `APNS_KEY_ID` | Apple APNs authentication key ID |
| `APNS_TEAM_ID` | Apple Developer team ID |
| `APNS_TOPIC` | Bundle ID; currently `com.tomos.app` |
| `APNS_ENVIRONMENT` | `development` for sandbox or `production` for distribution builds |
| `APNS_AUTH_KEY_BASE64` | Preferred: base64-encoded contents of the Apple `.p8` key |
| `CRON_SECRET` | Bearer secret required by `/api/send-push` and cron routes |
| `DATABASE_URL` | Neon Postgres connection containing `device_tokens` |

`APNS_AUTH_KEY` with escaped newlines is supported as a fallback. A local
`APNS_AUTH_KEY_PATH` is also supported for development only. Never commit the
`.p8` key or include it in handovers.

## API endpoints

### `POST /api/register-device`

Registers or reactivates an iOS, iPadOS, or macOS token in Postgres.

```json
{
  "device_token": "<APNs device token>",
  "platform": "ios",
  "bundle_id": "com.tomos.app",
  "name": "Tom's iPhone"
}
```

The route currently has no caller authentication. APNs still accepts only valid
tokens for the configured topic and environment, but registration authentication
should be added before distributing the app beyond Tom-controlled devices.

### `POST /api/send-push`

Sends one alert to every active registration. This route requires
`Authorization: Bearer $CRON_SECRET`.

```json
{
  "title": "Training Radar needs attention",
  "body": "2 slipped sessions | recovery check-in stale",
  "badge": 2
}
```

Optional fields are `task_id`, `priority`, `sound`, and `badge`. The route uses
the `TASK_NOTIFICATION` APNs category.

### `GET /api/send-push`

Returns a credential-presence and APNs-host diagnostic. It requires the same
bearer secret and never returns credentials.

## Current producers

The following TomOS routes reuse `/api/send-push`:

- Training Radar attention check: daily at `20:45 UTC`, after the Strava sync
- Legal deadline check: daily at `19:00 UTC`
- Life morning briefing: daily at `19:15 UTC`
- Gym suggestion route when invoked

Training Radar skips the push when every check is healthy and nothing needs
attention. Pushcut, Claude scheduled tasks, and Codex automations are not part of
this delivery path.

## Safe diagnostics

```bash
curl https://tomos-task-api.vercel.app/api/send-push \
  -H "Authorization: Bearer $CRON_SECRET"
```

Sending a test notification is a real external side effect:

```bash
curl -X POST https://tomos-task-api.vercel.app/api/send-push \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test notification",
    "body": "TomOS APNs delivery test",
    "badge": 1
  }'
```

## Troubleshooting

### `No active devices to notify`

- Launch the intended app and allow notifications.
- Confirm it called `/api/register-device` successfully.
- Check the `device_tokens` row is active.

### `BadDeviceToken` or `DeviceTokenNotForTopic`

- Check that the app bundle ID is `com.tomos.app`.
- Check that the token environment matches `APNS_ENVIRONMENT`.
- Reinstall and launch the app to obtain and register a current token.

### `APNs credentials not configured`

- Confirm the Vercel production environment contains `APNS_KEY_ID`,
  `APNS_TEAM_ID`, and `APNS_AUTH_KEY_BASE64`.
- Use the authenticated `GET /api/send-push` diagnostic to confirm the selected
  topic, environment, and host.

## Separate `tomos-nag` notifier

`tomos-nag` is a narrower replacement notifier hosted on Cloudflare Workers. It
reads timed tasks from Notion, stores device tokens and nag state in D1, and
routes each token to sandbox or production APNs according to the environment
reported by its iPhone app. Its canonical status is in the `tomos-nag`
repository's `BUILD_STATUS.md`; do not configure it through this Vercel route.
