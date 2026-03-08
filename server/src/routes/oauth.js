import { Hono } from 'hono';
import { saveConnection } from '../lib/supabase.js';

const oauth = new Hono();

const APP_URL = process.env.APP_URL || 'https://jorgeahmed.github.io/Pomodoro_RBR/app.html';
const API_URL = process.env.API_URL || 'http://localhost:3000';

// ─── Tool configs ──────────────────────────────────────────────────────────
const TOOLS = {
    todoist: {
        authorizeUrl: 'https://todoist.com/oauth/authorize',
        tokenUrl: 'https://todoist.com/oauth/access_token',
        clientId: process.env.TODOIST_CLIENT_ID,
        clientSecret: process.env.TODOIST_CLIENT_SECRET,
        scope: 'data:read',
        tokenField: 'access_token',
    },
    asana: {
        authorizeUrl: 'https://app.asana.com/-/oauth_authorize',
        tokenUrl: 'https://app.asana.com/-/oauth_token',
        clientId: process.env.ASANA_CLIENT_ID,
        clientSecret: process.env.ASANA_CLIENT_SECRET,
        scope: 'default',
        tokenField: 'access_token',
    },
    monday: {
        authorizeUrl: 'https://auth.monday.com/oauth2/authorize',
        tokenUrl: 'https://auth.monday.com/oauth2/token',
        clientId: process.env.MONDAY_CLIENT_ID,
        clientSecret: process.env.MONDAY_CLIENT_SECRET,
        scope: 'me:read boards:read',
        tokenField: 'access_token',
    },
    clickup: {
        authorizeUrl: 'https://app.clickup.com/api',
        tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
        clientId: process.env.CLICKUP_CLIENT_ID,
        clientSecret: process.env.CLICKUP_CLIENT_SECRET,
        scope: '',
        tokenField: 'access_token',
    },
    jira: {
        authorizeUrl: 'https://auth.atlassian.com/authorize',
        tokenUrl: 'https://auth.atlassian.com/oauth/token',
        clientId: process.env.JIRA_CLIENT_ID,
        clientSecret: process.env.JIRA_CLIENT_SECRET,
        scope: 'read:jira-user read:jira-work offline_access',
        tokenField: 'access_token',
        extraParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    },
};

// ─── GET /api/oauth/:tool/start ────────────────────────────────────────────
// Redirect user to PM tool's OAuth authorization page
oauth.get('/:tool/start', (c) => {
    const tool = c.req.param('tool');
    const cfg = TOOLS[tool];
    const userId = c.req.query('user_id') || 'anonymous';

    if (!cfg) return c.json({ error: 'Unknown tool' }, 400);
    if (!cfg.clientId) return c.json({ error: `${tool} OAuth not configured — add client ID to env vars` }, 503);

    const redirectUri = `${API_URL}/api/oauth/${tool}/callback`;
    const state = Buffer.from(JSON.stringify({ userId, tool })).toString('base64');

    const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        ...(cfg.scope ? { scope: cfg.scope } : {}),
        ...(cfg.extraParams || {}),
    });

    return c.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
});

// ─── GET /api/oauth/:tool/callback ─────────────────────────────────────────
// PM tool sends user back here with ?code=... Exchange code for token
oauth.get('/:tool/callback', async (c) => {
    const tool = c.req.param('tool');
    const cfg = TOOLS[tool];
    const code = c.req.query('code');
    const stateRaw = c.req.query('state');
    const error = c.req.query('error');

    if (error) return c.redirect(`${APP_URL}?oauth_error=${error}&tool=${tool}`);
    if (!cfg || !code) return c.json({ error: 'Invalid callback' }, 400);

    let userId = 'anonymous';
    try {
        const state = JSON.parse(Buffer.from(stateRaw, 'base64').toString());
        userId = state.userId;
    } catch { }

    const redirectUri = `${API_URL}/api/oauth/${tool}/callback`;

    // Exchange authorization code for access token
    try {
        const tokenRes = await fetch(cfg.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                code,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData[cfg.tokenField];

        if (!accessToken) {
            console.error(`[${tool}] Token exchange failed:`, tokenData);
            return c.redirect(`${APP_URL}?oauth_error=token_exchange_failed&tool=${tool}`);
        }

        // Save token to Supabase
        await saveConnection(userId, tool, accessToken, tokenData);

        // Redirect back to app with success signal
        return c.redirect(`${APP_URL}?oauth_success=${tool}&user_id=${userId}`);
    } catch (err) {
        console.error(`[${tool}] OAuth error:`, err);
        return c.redirect(`${APP_URL}?oauth_error=server_error&tool=${tool}`);
    }
});

export default oauth;
