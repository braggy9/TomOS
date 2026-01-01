# Related Repositories

## TomOS Ecosystem

The TomOS system is split across two repositories:

### 1. TomOS (THIS REPO)

**Purpose:** Serverless API backend  
**Technology:** Next.js 14, TypeScript, Vercel  
**Deployment:** `https://tomos-task-api.vercel.app`  
**Local Path:** `/Users/tombragg/Desktop/Projects/TomOS/`  
**GitHub:** `github.com/braggy9/TomOS.git` (Public)

**What it does:**
- Task creation and management
- APNs push notification sending
- Notion database integration
- Google Calendar sync
- AI-powered features
- Email-to-task processing

### 2. TomOS-Apps (Frontend)

**Purpose:** Native Swift applications  
**Technology:** SwiftUI, AppKit, APNs  
**Platforms:** iOS, iPadOS, macOS  
**Local Path:** `/Users/tombragg/Desktop/TomOS-Apps/`  
**GitHub:** `github.com/braggy9/TomOS-Apps.git` (Private)

**What it does:**
- User interface and interaction
- APNs device registration
- Local notifications (offline mode)
- Menu bar app (macOS)
- Quick task capture via Siri/Shortcuts

## How They Work Together

```
iOS/macOS App (TomOS-Apps)
  ↓ User creates task via Siri
  ↓ POST /api/task
Backend API (THIS REPO)
  ↓ Parse natural language
  ↓ Create task in Notion
  ↓ POST /api/send-push
  ↓ Query Notion for device tokens
  ↓ Send APNs push notification
iOS/macOS App
  ↓ Receive push notification
  ↓ Display with action buttons
```

## When Working in This Repo

**If you need to:**
- Add/modify API endpoints → Work here (TomOS)
- Change APNs sending logic → Work here
- Update Notion integration → Work here
- Modify task parsing → Work here
- Deploy to Vercel → Work here

**If you need to:**
- Add a UI feature → Switch to `/Users/tombragg/Desktop/TomOS-Apps/`
- Add keyboard shortcuts → Switch to frontend repo
- Update notification handling → Switch to frontend repo
- Fix Swift/Xcode issues → Switch to frontend repo

## Switching Repos in Claude Code

```bash
# Currently in backend, need to work on Swift app
cd /Users/tombragg/Desktop/TomOS-Apps
claude-code

# Currently in TomOS-Apps, need to work on backend
cd /Users/tombragg/Desktop/Projects/TomOS
claude-code
```

## Common Cross-Repo Workflows

### Adding a New API Endpoint

1. **Backend (THIS REPO):** Create `app/api/my-endpoint/route.ts`
2. **Backend:** Add environment variables if needed
3. **Backend:** Deploy to Vercel
4. **Frontend (TomOS-Apps):** Update APIService.swift to call new endpoint
5. **Frontend:** Update UI to use new feature

### Testing APNs End-to-End

1. **Frontend:** Run app, get device token
2. **Backend (THIS REPO):** Verify device registered in Notion
3. **Backend:** Send test push via `/api/send-push`
4. **Frontend:** Verify notification received

### Deploying a Feature

1. **Backend (THIS REPO):** Commit and push
2. **Backend:** Vercel auto-deploys on push
3. **Backend:** Check deployment logs
4. **Frontend:** Test integration with new backend

## Environment Variables

**Set in Vercel Dashboard:**
- Vercel → tomos-task-api → Settings → Environment Variables
- Changes require redeploy

**Local Testing:**
- `.env.local` (gitignored)
- Never commit secrets to Git

## Archive Location

**Old/Deprecated Files:** `/Users/tombragg/Desktop/TomOS-Archive/`

Contains:
- Legacy Python API (tomos-dashboard)
- Old documentation
- Setup guides from previous iterations
