# API Development Rules

## Route Structure

All API routes follow Next.js 14 App Router pattern:
```
app/api/{endpoint}/route.ts
```

## Standard Response Format

```typescript
// Success
NextResponse.json({ success: true, data: {...} })

// Error
NextResponse.json({ error: "Message", details: "..." }, { status: 4xx/5xx })
```

## Authentication Patterns

### Cron Endpoints
Protected with Bearer token:
```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Public Endpoints
- `/api/task` - Task creation (called from iOS/Alfred)
- `/api/register-device` - Device registration
- These don't require auth (device token is the auth)

## Error Handling

1. Always wrap in try/catch
2. Log errors with `console.error`
3. Return structured error responses
4. Don't expose stack traces in production

## Background Operations

Fire-and-forget pattern for secondary operations:
```typescript
// Don't await - run in background
syncToCalendar(taskId).catch(err =>
  console.error('Background calendar sync error:', err)
);
```

## Key Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| POST /api/task | None | Create task via Claude |
| POST /api/send-push | None | Send APNs notification |
| POST /api/register-device | None | Register device token |
| GET /api/notifications/* | Bearer | Scheduled notifications |
