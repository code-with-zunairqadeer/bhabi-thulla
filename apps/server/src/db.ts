/**
 * Postgres persistence (Neon). The server runs fully without a database —
 * when DATABASE_URL is unset, rooms and matches live in memory only and
 * every save is a silent no-op. With a database, schema migrations run at
 * boot and finished matches (players + event feed) are recorded.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

let pool: Pool | null = null;

export function dbEnabled(): boolean {
  return pool !== null;
}

export async function initDb(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[db] DATABASE_URL not set — running without persistence.');
    return;
  }
  pool = new Pool({ connectionString: url, max: 5 });
  await migrate();
  console.log('[db] Connected, migrations applied.');
}

async function migrate(): Promise<void> {
  if (!pool) return;
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())',
    );
    const applied = new Set(
      (await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version as string),
    );
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`[db] Applied migration ${version}.`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

export interface MatchRecord {
  id: string;
  roomCode: string;
  seats: number;
  pace: string;
  botFill: boolean;
  rulesVersion: string;
  bhabiSeat: number | null;
  draw: boolean;
  setAside: { id: string; suit: string; rank: string | number }[];
  players: {
    seat: number;
    guestId: string | null;
    name: string;
    isBot: boolean;
    escaped: boolean;
  }[];
  events: string[];
}

/** Persist a finished match. No-op when the database is disabled. */
export async function saveMatchResult(rec: MatchRecord): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO matches (id, room_code, seats, pace, bot_fill, rules_version, status, finished_at, bhabi_seat, draw, set_aside)
       VALUES ($1,$2,$3,$4,$5,$6,'finished',now(),$7,$8,$9)`,
      [
        rec.id,
        rec.roomCode,
        rec.seats,
        rec.pace,
        rec.botFill,
        rec.rulesVersion,
        rec.bhabiSeat,
        rec.draw,
        JSON.stringify(rec.setAside),
      ],
    );
    for (const p of rec.players) {
      await client.query(
        `INSERT INTO match_players (match_id, seat, guest_id, name, is_bot, escaped)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [rec.id, p.seat, p.guestId, p.name, p.isBot, p.escaped],
      );
    }
    for (let i = 0; i < rec.events.length; i++) {
      await client.query(
        'INSERT INTO match_events (match_id, seq, event) VALUES ($1,$2,$3)',
        [rec.id, i, rec.events[i]],
      );
    }
    await client.query('COMMIT');
    console.log(`[db] Saved match ${rec.id} (${rec.events.length} events).`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[db] Failed to save match:', (e as Error).message);
  } finally {
    client.release();
  }
}
