import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import oauthRoutes from './routes/oauth.js';
import reportRoutes from './routes/report.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
    origin: [
        'https://jorgeahmed.github.io',
        'http://localhost:5500',
        'http://localhost:3001',
        'http://127.0.0.1:5500',
    ],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => c.json({
    service: 'Syncro-Daily API',
    version: '1.0.0',
    status: 'online',
    endpoints: [
        'GET  /api/oauth/:tool/start?user_id=xxx  — Start OAuth flow',
        'GET  /api/oauth/:tool/callback           — OAuth callback (handle by server)',
        'POST /api/report/send                    — Send daily report email',
        'GET  /api/tasks/:tool?user_id=xxx        — Fetch tasks from connected tool',
    ],
}));

// Routes
app.route('/api/oauth', oauthRoutes);
app.route('/api', reportRoutes);

// Start server
const port = parseInt(process.env.PORT || '3000');
console.log(`🚀 Syncro-Daily API running on port ${port}`);

serve({ fetch: app.fetch, port });
