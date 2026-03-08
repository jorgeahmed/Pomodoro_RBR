# Syncro-Daily API Server

Backend server for real OAuth and daily email reports.  
Built with [Hono.js](https://hono.dev) → deployed to [Railway](https://railway.app).

## Deploy in 5 minutes

### 1. Fork / push to GitHub
The server lives in the `server/` folder of the repo.

### 2. Create Railway project
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `Pomodoro_RBR` → set **Root Directory** to `server`
3. Railway auto-detects Node.js and runs `npm start`

### 3. Add environment variables in Railway
Copy `.env.example` → fill in Railway's **Variables** panel:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| `TODOIST_CLIENT_ID/SECRET` | todoist.com/prefs/integrations → Create App |
| `ASANA_CLIENT_ID/SECRET` | app.asana.com/0/my-apps → Create App |
| `MONDAY_CLIENT_ID/SECRET` | monday.com/settings/apps → Create App |
| `CLICKUP_CLIENT_ID/SECRET` | app.clickup.com/settings/apps |
| `JIRA_CLIENT_ID/SECRET` | developer.atlassian.com/console/myapps |
| `API_URL` | Your Railway URL (e.g. `https://syncro-daily.up.railway.app`) |
| `APP_URL` | `https://jorgeahmed.github.io/Pomodoro_RBR/app.html` |

### 4. Register OAuth apps (one time)
For each PM tool, create an OAuth app and set the redirect URI to:
```
https://YOUR-RAILWAY-URL/api/oauth/TOOL_NAME/callback
```
Example for Todoist:
```
https://syncro-daily.up.railway.app/api/oauth/todoist/callback
```

### 5. Supabase tables
Run this SQL in Supabase SQL Editor:
```sql
-- User PM tool connections (stores OAuth tokens)
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  tool text not null,
  access_token text not null,
  extra jsonb,
  connected_at timestamptz default now(),
  unique(user_id, tool)
);

-- Newsletter subscribers
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  active boolean default true,
  created_at timestamptz default now()
);
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/api/oauth/:tool/start?user_id=xxx` | Start OAuth flow |
| GET | `/api/oauth/:tool/callback` | OAuth callback (automatic) |
| GET | `/api/tasks/:tool?user_id=xxx` | Fetch tasks from connected tool |
| POST | `/api/report/send` | Generate + send daily report email |
