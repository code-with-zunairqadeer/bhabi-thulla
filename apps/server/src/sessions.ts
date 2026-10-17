/**
 * Guest sessions. No passwords, no accounts: POST /api/session { name }
 * returns a guestId and a signed token. The token is HMAC-signed with the
 * server secret, so it is stateless — any server instance holding the secret
 * can verify it. Keep SERVER_SECRET stable in production (env var) so
 * sessions survive restarts and redeploys.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

let secret = '';

export function initSessions(configuredSecret?: string): void {
  if (configuredSecret) {
    secret = configuredSecret;
  } else {
    secret = randomBytes(32).toString('hex');
    console.warn(
      '[sessions] SERVER_SECRET not set — generated an ephemeral secret. ' +
        'Sessions will not survive a restart. Set SERVER_SECRET in production.',
    );
  }
}

function sign(guestId: string): string {
  return createHmac('sha256', secret).update(guestId).digest('hex').slice(0, 32);
}

export function createSession(): { guestId: string; token: string } {
  const guestId = randomUUID();
  return { guestId, token: `${guestId}.${sign(guestId)}` };
}

/** Returns the guestId when the token is valid, else null. */
export function verifyToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const guestId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(guestId);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return guestId;
}
