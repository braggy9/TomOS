# APNs (Apple Push Notification Service) Rules

## Overview

TomOS uses APNs for all push notifications to iOS/macOS devices.
This is the ONLY push notification method - ntfy has been fully deprecated.

## Architecture

```
Backend → /api/send-push → APNs HTTP/2 → iOS/macOS Device
                ↓
         Notion DB (device tokens)
```

## Implementation

### Device Registration (`/api/register-device`)
1. iOS/macOS app requests push permission
2. Apple returns device token
3. App calls `/api/register-device` with token
4. Token stored in Notion "Device Tokens" database

### Sending Push (`/api/send-push`)
1. Fetch all active device tokens from Notion
2. Generate JWT for APNs auth (ES256 algorithm)
3. Connect to APNs via HTTP/2
4. Send notification to each device
5. Handle 410 (unregistered) by marking device inactive

## Environment Variables

```
APNS_KEY_ID=Z5X44X9KD7          # Key ID from Apple
APNS_TEAM_ID=89NX9R78Y7         # Team ID from Apple
APNS_TOPIC=com.tomos.app        # Bundle identifier
APNS_ENVIRONMENT=development    # development or production
APNS_AUTH_KEY=<.p8 contents>    # Full private key
NOTION_DEVICE_TOKENS_DB_ID=     # Auto-created on first registration
```

## JWT Token Generation

- Algorithm: ES256
- Issuer: Team ID
- Issued At: Current timestamp
- Key ID in header
- Cache for 50 minutes (valid 1 hour)

## APNs Hosts

- Development: `api.sandbox.push.apple.com`
- Production: `api.push.apple.com`

## Payload Format

```json
{
  "aps": {
    "alert": {
      "title": "Task Created",
      "body": "Review quarterly report"
    },
    "badge": 1,
    "sound": "default"
  },
  "task_id": "notion-page-id"
}
```

## Error Handling

- 200: Success
- 400: Bad device token → remove from database
- 410: Device unregistered → mark inactive
- 429: Rate limited → implement backoff
- 500: Retry with exponential backoff
