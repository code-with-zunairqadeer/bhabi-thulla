/**
 * @bhabi-thulla/protocol — the wire contract between the web client and the
 * authoritative game server. Every client command is validated with zod on
 * the server; every server event has a TypeScript type both sides share.
 *
 * Transport: Socket.IO. Client commands are emitted as `cmd:<name>` with a
 * JSON payload and an acknowledgement callback `{ ok, error?, data? }`.
 * Server events are broadcast as `room:update`, `game:state`, `game:over`.
 *
 * The server never sends hidden information: each socket receives a
 * per-player filtered view (your hand, everyone else's card counts).
 */
import { z } from 'zod';

/* ── Shared primitives ─────────────────────────────────────────── */

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export interface CardDTO {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type Pace = 'relaxed' | 'normal' | 'fast';
export const PACES: readonly Pace[] = ['relaxed', 'normal', 'fast'];

export type RoomStatus = 'lobby' | 'playing' | 'finished';

/* ── Client commands (validated with zod) ──────────────────────── */

const nameSchema = z.string().trim().min(1).max(24);

export const CreateRoomSchema = z.object({
  name: nameSchema,
  seats: z.number().int().min(4).max(7),
  pace: z.enum(['relaxed', 'normal', 'fast']).default('relaxed'),
  botFill: z.boolean().default(true),
});
export type CreateRoom = z.infer<typeof CreateRoomSchema>;

export const JoinRoomSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/, 'Invalid room code'),
  name: nameSchema,
});
export type JoinRoom = z.infer<typeof JoinRoomSchema>;

export const SetReadySchema = z.object({
  ready: z.boolean(),
});
export type SetReady = z.infer<typeof SetReadySchema>;

export const UpdateSettingsSchema = z.object({
  seats: z.number().int().min(4).max(7).optional(),
  pace: z.enum(['relaxed', 'normal', 'fast']).optional(),
  botFill: z.boolean().optional(),
});
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

export const PlayCardSchema = z.object({
  /** Engine card id, e.g. "A-spades", "10-hearts". */
  cardId: z.string().min(2).max(16),
  /**
   * Client-generated UUID. The server remembers processed action ids per
   * match, so a retried tap (double-click, reconnect replay) can never
   * apply the same play twice — the current state is simply re-sent.
   */
  actionId: z.string().uuid(),
});
export type PlayCard = z.infer<typeof PlayCardSchema>;

export const EmptySchema = z.object({});
export type Empty = z.infer<typeof EmptySchema>;

export const COMMAND_SCHEMAS = {
  'cmd:create-room': CreateRoomSchema,
  'cmd:join-room': JoinRoomSchema,
  'cmd:leave-room': EmptySchema,
  'cmd:set-ready': SetReadySchema,
  'cmd:update-settings': UpdateSettingsSchema,
  'cmd:start-match': EmptySchema,
  'cmd:play-card': PlayCardSchema,
  'cmd:rematch': EmptySchema,
} as const;

export type CommandName = keyof typeof COMMAND_SCHEMAS;

export interface Ack<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

/* ── Server events ─────────────────────────────────────────────── */

export interface LobbyPlayerView {
  guestId: string;
  name: string;
  /** Seat index once the match starts; null while in lobby. */
  seat: number | null;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
}

export interface RoomSettingsView {
  seats: number;
  pace: Pace;
  botFill: boolean;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  settings: RoomSettingsView;
  hostGuestId: string;
  players: LobbyPlayerView[];
}

export interface SeatView {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  escaped: boolean;
}

export interface TrickPlayDTO {
  seat: number;
  card: CardDTO;
}

export interface CompletedTrickDTO {
  plays: TrickPlayDTO[];
  ledSuit: Suit;
}

/**
 * The full per-player game view. `hand` and `legalCardIds` are only ever
 * populated for the recipient's own seat — everyone else sees counts.
 */
export interface GameView {
  code: string;
  phase: 'awaiting_action' | 'finished';
  numSeats: number;
  /** Recipient's seat, or null for spectators (not used in v1). */
  mySeat: number | null;
  turn: number | null;
  turnName: string;
  hand: CardDTO[];
  legalCardIds: string[];
  seats: SeatView[];
  trick: { leader: number; ledSuit: Suit | null; plays: TrickPlayDTO[] } | null;
  completedTrick: CompletedTrickDTO | null;
  thullaFlash: boolean;
  /** Tail of the public event feed. */
  events: string[];
  /** Seconds left on the current human turn, null when not applicable. */
  secondsLeft: number | null;
  pace: Pace;
  isFirstTrick: boolean;
  setAsideCount: number;
}

export interface GameOverView {
  code: string;
  bhabi: number | null;
  bhabiName: string | null;
  youAreBhabi: boolean;
  draw: boolean;
  escapeOrder: string[];
  seats: { seat: number; name: string; isBot: boolean; escaped: boolean }[];
}

export interface ServerError {
  code: string;
  message: string;
}

export type ServerEventMap = {
  'room:update': RoomView;
  'game:state': GameView;
  'game:over': GameOverView;
  'server:error': ServerError;
};

/** Room codes: 6 chars, unambiguous alphabet (no 0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
