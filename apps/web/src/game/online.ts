/**
 * Online client singleton — the browser's connection to the authoritative
 * game server. One room at a time. Session tokens persist in localStorage;
 * if the server rejects a cached token (fresh secret after a restart), the
 * session is recreated once and the socket reconnects.
 *
 * Server URL resolution: explicit localStorage override (`bhabi.serverUrl`,
 * handy for testing against localhost) → VITE_SERVER_URL (baked at build
 * time) → the production Render service.
 */
import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  GameOverView,
  GameView,
  Pace,
  RoomView,
} from '@bhabi-thulla/protocol';
import { randomUUID } from './uuid';

export function getServerUrl(): string {
  const override = localStorage.getItem('bhabi.serverUrl');
  if (override) return override.replace(/\/$/, '');
  const baked = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (baked) return baked.replace(/\/$/, '');
  return 'https://bhabi-thulla-server.onrender.com';
}

interface Session {
  guestId: string;
  token: string;
}

const SESSION_KEY = 'bhabi.session';

async function createSession(name: string): Promise<Session> {
  const res = await fetch(`${getServerUrl()}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Could not reach the game server. Try again.');
  const json = (await res.json()) as Ack<Session> & Session;
  if (!json.ok || !json.token) throw new Error('Could not reach the game server. Try again.');
  const s: Session = { guestId: json.guestId, token: json.token };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}

async function ensureSession(name: string): Promise<Session> {
  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) {
    try {
      const s = JSON.parse(cached) as Session;
      if (s.guestId && s.token) return s;
    } catch {
      /* fall through and recreate */
    }
  }
  return createSession(name);
}

export type OnlineStatus =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'playing'
  | 'finished'
  | 'error';

export interface OnlineSnapshot {
  status: OnlineStatus;
  room: RoomView | null;
  game: GameView | null;
  over: GameOverView | null;
  guestId: string | null;
  error: string | null;
  connected: boolean;
}

type Listener = () => void;

function emitAck(socket: Socket, event: string, payload: unknown): Promise<Ack<unknown>> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (ack: Ack<unknown> | undefined) => {
      resolve(ack ?? { ok: false, error: 'No response from server.' });
    });
  });
}

class OnlineClient {
  private socket: Socket | null = null;
  private listeners = new Set<Listener>();
  private snapshot: OnlineSnapshot = {
    status: 'idle',
    room: null,
    game: null,
    over: null,
    guestId: null,
    error: null,
    connected: false,
  };
  private retriedSession = false;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): OnlineSnapshot => this.snapshot;

  private set(patch: Partial<OnlineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  private async connect(name: string): Promise<Socket> {
    if (this.socket?.connected) return this.socket;
    this.set({ status: 'connecting', error: null });
    const session = await ensureSession(name);
    const socket = io(getServerUrl(), {
      auth: { token: session.token },
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    this.socket = socket;
    this.set({ guestId: session.guestId });

    socket.on('connect', () => this.set({ connected: true, error: null }));
    socket.on('disconnect', () => this.set({ connected: false }));
    socket.on('connect_error', async (err: Error) => {
      // Stale cached token (server restarted with a new secret) — recreate
      // the session once and retry.
      if (!this.retriedSession && /token/i.test(err.message)) {
        this.retriedSession = true;
        localStorage.removeItem(SESSION_KEY);
        try {
          const fresh = await createSession(name);
          socket.auth = { token: fresh.token };
          this.set({ guestId: fresh.guestId });
          socket.connect();
          return;
        } catch {
          /* fall through to the error state */
        }
      }
      this.set({ status: 'error', error: 'Could not connect to the game server.' });
    });
    socket.on('room:update', (room: RoomView) => {
      this.set({
        room,
        status: room.status === 'lobby' ? 'lobby' : this.snapshot.status,
        // A rematch drops us back to the lobby — clear the old table.
        ...(room.status === 'lobby' ? { game: null, over: null } : {}),
      });
    });
    socket.on('game:state', (game: GameView) => {
      this.set({
        game,
        status: game.phase === 'finished' ? this.snapshot.status : 'playing',
        over: null,
      });
    });
    socket.on('game:over', (over: GameOverView) => {
      this.set({ over, status: 'finished' });
    });
    socket.on('server:error', (e: { message?: string }) => {
      this.set({ error: e.message ?? 'Something went wrong.' });
    });

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onFail = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onFail);
      };
      socket.on('connect', onConnect);
      socket.on('connect_error', onFail);
      setTimeout(() => {
        cleanup();
        reject(new Error('Connection timed out.'));
      }, 12000);
    });
    this.retriedSession = false;
    return socket;
  }

  /** Host a new table. Resolves with the room code. */
  async host(
    name: string,
    opts: { seats: number; pace: Pace; botFill: boolean },
  ): Promise<string> {
    const socket = await this.connect(name);
    const ack = await emitAck(socket, 'cmd:create-room', { name, ...opts });
    if (!ack.ok) throw new Error(ack.error ?? 'Could not create the table.');
    const code = (ack.data as { code: string }).code;
    this.set({ status: 'lobby' });
    return code;
  }

  async join(name: string, code: string): Promise<void> {
    const socket = await this.connect(name);
    const ack = await emitAck(socket, 'cmd:join-room', { code, name });
    if (!ack.ok) throw new Error(ack.error ?? 'Could not join the table.');
    this.set({ status: 'lobby' });
  }

  async setReady(ready: boolean): Promise<void> {
    this.ensureSocket();
    const ack = await emitAck(this.socket!, 'cmd:set-ready', { ready });
    if (!ack.ok) throw new Error(ack.error ?? 'Could not update ready state.');
  }

  async updateSettings(patch: { seats?: number; pace?: Pace; botFill?: boolean }): Promise<void> {
    this.ensureSocket();
    const ack = await emitAck(this.socket!, 'cmd:update-settings', patch);
    if (!ack.ok) throw new Error(ack.error ?? 'Could not update settings.');
  }

  async startMatch(): Promise<void> {
    this.ensureSocket();
    const ack = await emitAck(this.socket!, 'cmd:start-match', {});
    if (!ack.ok) throw new Error(ack.error ?? 'Could not start the match.');
  }

  /** Play a card. Returns an error message, or null on success. */
  async playCard(cardId: string): Promise<string | null> {
    this.ensureSocket();
    const ack = await emitAck(this.socket!, 'cmd:play-card', {
      cardId,
      actionId: randomUUID(),
    });
    return ack.ok ? null : (ack.error ?? 'Illegal play.');
  }

  async rematch(): Promise<void> {
    this.ensureSocket();
    const ack = await emitAck(this.socket!, 'cmd:rematch', {});
    if (!ack.ok) throw new Error(ack.error ?? 'Could not start a rematch.');
  }

  leave(): void {
    if (this.socket?.connected) {
      this.socket.emit('cmd:leave-room', {});
    }
    this.disconnect();
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.snapshot = {
      status: 'idle',
      room: null,
      game: null,
      over: null,
      guestId: this.snapshot.guestId,
      error: null,
      connected: false,
    };
    for (const fn of this.listeners) fn();
  }

  private ensureSocket(): void {
    if (!this.socket?.connected) throw new Error('Not connected to the game server.');
  }
}

export const online = new OnlineClient();
