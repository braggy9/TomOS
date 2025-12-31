# APNs Push Notification Setup

This document explains how to configure Apple Push Notification service (APNs) for TomOS.

## Overview

TomOS uses APNs to send push notifications to iOS, iPadOS, and macOS devices. The implementation uses:

- **Token-based authentication** (JWT) - More secure and easier to manage than certificates
- **HTTP/2 API** - Modern APNs protocol with better performance
- **Notion database** - Stores device tokens for registered devices

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  TomOS App   │────▶│   Vercel     │────▶│    APNs      │────▶│  iOS/macOS   │
│  (iOS/Mac)   │     │   Backend    │     │   Servers    │     │   Device     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    │
       ▼                    ▼
   Register            Query tokens
   device token        from Notion
```

## Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `APNS_KEY_ID` | Your APNs Key ID (10 characters) | `Z5X44X9KD7` |
| `APNS_TEAM_ID` | Your Apple Developer Team ID | `89NX9R78Y7` |
| `APNS_TOPIC` | App bundle identifier | `com.tomos.app` |
| `APNS_ENVIRONMENT` | `development` or `production` | `development` |
| `APNS_AUTH_KEY` | Contents of your .p8 key file | `-----BEGIN PRIVATE KEY-----\n...` |
| `NOTION_DEVICE_TOKENS_DB_ID` | Notion database ID for device tokens | (auto-created) |

### Setting up APNS_AUTH_KEY

The APNs authentication key is a .p8 file from Apple Developer. To add it to Vercel:

1. Open your `.p8` file in a text editor
2. Copy the entire contents including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
3. In Vercel, create a new environment variable named `APNS_AUTH_KEY`
4. Paste the key contents (Vercel handles multi-line values)

**Important:** Never commit the .p8 file to version control!

## API Endpoints

### POST /api/register-device

Registers a device token for push notifications.

**Request:**
```json
{
  "device_token": "a1b2c3d4e5f6...",
  "platform": "ios",
  "bundle_id": "com.tomos.app",
  "app_version": "1.0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device token registered",
  "device_id": "notion-page-id"
}
```

### POST /api/send-push

Sends a push notification to all registered devices.

**Request:**
```json
{
  "title": "Task Reminder",
  "body": "Review quarterly report - Due in 1 hour",
  "task_id": "notion-page-id",
  "priority": "urgent",
  "badge": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push notification sent to 2 device(s)",
  "sent_to": 2,
  "devices": ["a1b2c3d4... (iOS)", "e5f6g7h8... (macOS)"],
  "errors": []
}
```

## Testing

### Test with curl

**Register a device:**
```bash
curl -X POST https://tomos-task-api.vercel.app/api/register-device \
  -H "Content-Type: application/json" \
  -d '{
    "device_token": "your-device-token-here",
    "platform": "ios",
    "bundle_id": "com.tomos.app",
    "app_version": "1.0"
  }'
```

**Send a test notification:**
```bash
curl -X POST https://tomos-task-api.vercel.app/api/send-push \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test push notification",
    "task_id": "test-123",
    "priority": "normal"
  }'
```

**Check endpoint status:**
```bash
curl https://tomos-task-api.vercel.app/api/register-device
curl https://tomos-task-api.vercel.app/api/send-push
```

### Local Testing

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your credentials:
   ```
   NOTION_API_KEY=your-notion-key
   APNS_KEY_ID=Z5X44X9KD7
   APNS_TEAM_ID=89NX9R78Y7
   APNS_TOPIC=com.tomos.app
   APNS_ENVIRONMENT=development
   APNS_AUTH_KEY="-----BEGIN PRIVATE KEY-----
   ...your key contents...
   -----END PRIVATE KEY-----"
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Test endpoints at `http://localhost:3000/api/...`

## APNs Response Codes

| Status | Reason | Action |
|--------|--------|--------|
| 200 | Success | Notification delivered to APNs |
| 400 | BadDeviceToken | Remove device from database |
| 403 | Forbidden | Check team ID and bundle ID |
| 410 | Unregistered | Device uninstalled app, remove token |
| 429 | TooManyRequests | Implement rate limiting |
| 500 | InternalServerError | Retry with exponential backoff |

## Troubleshooting

### "No active devices to notify"
- Check Notion database has device entries with `Active = true`
- Verify `NOTION_DEVICE_TOKENS_DB_ID` is set correctly

### "APNs credentials not configured"
- Verify all `APNS_*` environment variables are set in Vercel
- Check for typos in variable names

### "BadDeviceToken"
- Token may be invalid or expired
- App may have been reinstalled (new token generated)
- Check you're using the correct APNs environment (sandbox vs production)

### "MissingTopic"
- Ensure `APNS_TOPIC` matches your app's bundle identifier

## Security Notes

1. **Never commit credentials** - Use environment variables
2. **Rotate keys periodically** - Generate new .p8 keys yearly
3. **Use HTTPS only** - All API calls must use HTTPS
4. **Validate tokens** - Tokens should be 64 hex characters
5. **Rate limit** - APNs has rate limits; batch notifications when possible
