# Work MBP Setup Guide (No Raycast)

Quick capture and app access for the Work MacBook Pro using Apple Shortcuts + shell aliases.

---

## 1. Shell Aliases (Open Apps)

Add to `~/.zshrc`:

```bash
# TomOS App Shortcuts
alias tt='open https://tomos-tasks.vercel.app'
alias tn='open https://tomos-notes.vercel.app'
alias tm='open https://tomos-matters.vercel.app'
alias tj='open https://tomos-journal.vercel.app'
alias tf='open https://tomos-fitness.vercel.app'
```

Then run `source ~/.zshrc`.

---

## 2. Apple Shortcuts — Quick Capture

Create these 3 shortcuts in the Shortcuts app (Launchpad > Shortcuts):

### Quick Task

1. Open Shortcuts > click `+` to create new shortcut
2. Name it: **Quick Task**
3. Add action: **Ask for Input**
   - Question: `What's the task?`
   - Input Type: Text
4. Add action: **Get Contents of URL**
   - URL: `https://tomos-task-api.vercel.app/api/task`
   - Method: POST
   - Headers: `Content-Type` = `application/json`
   - Request Body (JSON):
     - `task` = (Provided Input)
     - `source` = `Shortcut`
5. Add action: **Show Notification**
   - Title: `Task Created`
   - Body: (Provided Input)
6. **Set keyboard shortcut:** Click the shortcut name > Details > Add Keyboard Shortcut > `Ctrl+Opt+T`

### Quick Note

1. Create new shortcut named **Quick Note**
2. Add action: **Ask for Input** — Question: `Note title?`
3. Add variable: Set `noteTitle` to Provided Input
4. Add action: **Ask for Input** — Question: `Note content?` — Input Type: Text
5. Add action: **Get Contents of URL**
   - URL: `https://tomos-task-api.vercel.app/api/notes`
   - Method: POST
   - Headers: `Content-Type` = `application/json`
   - Request Body (JSON):
     - `title` = `noteTitle`
     - `content` = (Provided Input)
6. Add action: **Show Notification** — `Note Created`
7. **Keyboard shortcut:** `Ctrl+Opt+N`

### Quick Journal

1. Create new shortcut named **Quick Journal**
2. Add action: **Ask for Input** — Question: `How's it going?` — Input Type: Text
3. Add action: **Get Contents of URL**
   - URL: `https://tomos-task-api.vercel.app/api/journal/entries`
   - Method: POST
   - Headers: `Content-Type` = `application/json`
   - Request Body (JSON):
     - `content` = (Provided Input)
4. Add action: **Show Notification** — `Journal Entry Saved`
5. **Keyboard shortcut:** `Ctrl+Opt+J`

---

## 3. Apple Shortcuts — Open Apps (with Keyboard Shortcuts)

Create 4 simple shortcuts, each with a single "Open URLs" action:

| Shortcut Name | URL | Keyboard Shortcut |
|---------------|-----|-------------------|
| Open Tasks | `https://tomos-tasks.vercel.app` | `Ctrl+Opt+1` |
| Open Notes | `https://tomos-notes.vercel.app` | `Ctrl+Opt+2` |
| Open Matters | `https://tomos-matters.vercel.app` | `Ctrl+Opt+3` |
| Open Journal | `https://tomos-journal.vercel.app` | `Ctrl+Opt+4` |

For each:
1. Create new shortcut
2. Add action: **Open URLs** > paste the URL
3. Click shortcut name > Details > Add Keyboard Shortcut

---

## 4. Automator Fallback (if Shortcuts has latency)

If Apple Shortcuts feels sluggish, create Automator Quick Actions as a fallback:

1. Open Automator > New > Quick Action
2. Set "Workflow receives" to **no input**
3. Add action: **Run Shell Script**
4. Paste this script (example for Quick Task):

```bash
TASK=$(osascript -e 'display dialog "What'\''s the task?" default answer "" buttons {"Cancel","Create"} default button "Create"' -e 'text returned of result' 2>/dev/null)
[ -z "$TASK" ] && exit 0
RESULT=$(curl -s -X POST https://tomos-task-api.vercel.app/api/task \
  -H "Content-Type: application/json" \
  -d "{\"task\":\"$TASK\",\"source\":\"Automator\"}")
osascript -e "display notification \"Task created\" with title \"TomOS\""
```

5. Save as "Quick Task"
6. Go to System Settings > Keyboard > Keyboard Shortcuts > Services > assign a shortcut

Repeat for Quick Note and Quick Journal with the appropriate API endpoints.

---

## Summary

| Method | Best For | Both MBPs? |
|--------|----------|------------|
| Shell aliases (`tt`, `tn`, etc.) | Terminal users | Yes |
| Apple Shortcuts (Open URLs) | Global keyboard shortcuts | Yes |
| Apple Shortcuts (Quick Capture) | Creating tasks/notes/journal from anywhere | Yes |
| Automator Quick Actions | Fallback if Shortcuts is slow | Yes |
