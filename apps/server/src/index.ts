/**
 * @bhabi-thulla/server — authoritative Bhabi Thulla game server.
 *
 * HTTP:  GET  /health            liveness probe for Render
 *        POST /api/session       { name } -> { guestId, token }
 * WS:    Socket.IO with token auth (see protocol + sockets.ts)
 *
 * Env:   PORT (default 3001), CLIENT_URL (CORS origin, default *),
 *        SERVER_SECRET (session signing; generated ephemerally if unset),
 *        DATABASE_URL (Neon Postgres; persistence disabled when unset).
 */
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { createSession, initSessions } from './sessions.js';
import { initDb, dbEnabled } from './db.js';
import { RoomManager } from './rooms.js';
import { attachSockets } from './sockets.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_URL = process.env.CLIENT_URL ?? '*';

async function main(): Promise<void> {
  initSessions(process.env.SERVER_SECRET);
  await initDb();

  const app = express();
  app.use(express.json({ limit: '16kb' }));

  // CORS for the HTTP API (Socket.IO configures its own below).
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CLIENT_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, db: dbEnabled(), time: new Date().toISOString() });
  });

  const SessionBody = z.object({ name: z.string().trim().min(1).max(24) });
  app.post('/api/session', (req, res) => {
    const parsed = SessionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Name is required (1-24 characters).' });
      return;
    }
    // The name is bound to the socket Player on room join; the session
    // itself only needs a stable guest identity.
    void parsed.data.name;
    res.json({ ok: true, ...createSession() });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: CLIENT_URL === '*' ? true : CLIENT_URL,
      methods: ['GET', 'POST'],
    },
    // Heartbeats keep Render's proxy from idling the socket.
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  const rooms = new RoomManager();
  attachSockets(io, rooms);

  httpServer.listen(PORT, () => {
    console.log(`[server] Bhabi Thulla server listening on :${PORT}`);
    console.log(`[server] CORS origin: ${CLIENT_URL}`);
  });
}

main().catch((e) => {
  console.error('[server] Fatal boot error:', e);
  process.exit(1);
});
