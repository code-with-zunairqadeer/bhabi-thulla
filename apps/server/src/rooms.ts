/**
 * Room management: lobbies, membership, host migration, seat assignment.
 * Rooms live in memory; finished matches are persisted to Postgres by the
 * game controller. Bots are virtual — they fill seats but never hold a
 * socket or a Player entry.
 */
import { makeRoomCode, Pace, RoomStatus } from '@bhabi-thulla/protocol';
import type { GameController } from './game.js';

export interface Player {
  guestId: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  /** Seat index once a match starts, null while in lobby. */
  seat: number | null;
  joinedAt: number;
  lastSeen: number;
}

export interface RoomSettings {
  seats: number;
  pace: Pace;
  botFill: boolean;
}

export interface Room {
  code: string;
  hostGuestId: string;
  settings: RoomSettings;
  status: RoomStatus;
  players: Map<string, Player>;
  game: GameController | null;
  createdAt: number;
  /** When the last human left; the room is swept after the grace period. */
  emptySince: number | null;
}

export const BOT_NAMES = [
  'Alpha Bot',
  'Beta Bot',
  'Gamma Bot',
  'Delta Bot',
  'Zeta Bot',
  'Eta Bot',
  'Theta Bot',
];

const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;
const RECONNECT_GRACE_MS = 90 * 1000;

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor() {
    // Sweep abandoned rooms every minute.
    setInterval(() => this.sweep(), 60_000).unref();
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  findPlayerRoom(guestId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(guestId)) return room;
    }
    return undefined;
  }

  create(hostGuestId: string, name: string, settings: RoomSettings): Room {
    // A guest sits at one table at a time.
    this.leaveAll(hostGuestId);
    let code = makeRoomCode();
    while (this.rooms.has(code)) code = makeRoomCode();
    const room: Room = {
      code,
      hostGuestId,
      settings: { ...settings },
      status: 'lobby',
      players: new Map(),
      game: null,
      createdAt: Date.now(),
      emptySince: null,
    };
    room.players.set(hostGuestId, {
      guestId: hostGuestId,
      name,
      socketId: null,
      connected: false,
      seat: null,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
    this.rooms.set(code, room);
    return room;
  }

  join(code: string, guestId: string, name: string): Room {
    const room = this.get(code);
    if (!room) throw new Error('Room not found. Check the code and try again.');
    if (room.status === 'playing') {
      // Only a seated player may rejoin a live game (reconnect path).
      const existing = room.players.get(guestId);
      if (!existing || existing.seat === null) {
        throw new Error('That table is mid-game. Ask the host for the next one.');
      }
      existing.name = name || existing.name;
      existing.lastSeen = Date.now();
      room.emptySince = null;
      return room;
    }
    if (room.status === 'finished') {
      throw new Error('That table just finished. Ask the host to start a rematch.');
    }
    this.leaveAll(guestId);
    const existing = room.players.get(guestId);
    if (existing) {
      existing.name = name || existing.name;
      existing.lastSeen = Date.now();
    } else {
      if (room.players.size >= room.settings.seats) {
        throw new Error('That table is full.');
      }
      room.players.set(guestId, {
        guestId,
        name,
        socketId: null,
        connected: false,
        seat: null,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
    }
    room.emptySince = null;
    return room;
  }

  /** Remove a guest from every room they are in. Returns affected rooms. */
  leaveAll(guestId: string): Room[] {
    const affected: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.delete(guestId)) {
        affected.push(room);
        this.afterMembershipChange(room, guestId);
      }
    }
    return affected;
  }

  leave(code: string, guestId: string): Room | undefined {
    const room = this.get(code);
    if (!room || !room.players.delete(guestId)) return room;
    this.afterMembershipChange(room, guestId);
    return room;
  }

  private afterMembershipChange(room: Room, departedGuestId: string): void {
    // Host migrates to the longest-seated connected human.
    if (room.hostGuestId === departedGuestId) {
      const next = [...room.players.values()]
        .filter((p) => p.connected)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) {
        room.hostGuestId = next.guestId;
      }
    }
    if (room.players.size === 0) {
      room.emptySince = Date.now();
    }
  }

  attachSocket(room: Room, guestId: string, socketId: string): Player | undefined {
    const player = room.players.get(guestId);
    if (!player) return undefined;
    player.socketId = socketId;
    player.connected = true;
    player.lastSeen = Date.now();
    room.emptySince = null;
    return player;
  }

  detachSocket(guestId: string): { room: Room; player: Player } | undefined {
    const room = this.findPlayerRoom(guestId);
    if (!room) return undefined;
    const player = room.players.get(guestId);
    if (!player) return undefined;
    player.socketId = null;
    player.connected = false;
    player.lastSeen = Date.now();
    // If nobody connected remains, start the abandonment clock (the game
    // keeps running — bots cover disconnected seats — in case they return).
    const anyone = [...room.players.values()].some((p) => p.connected);
    if (!anyone) room.emptySince = Date.now();
    return { room, player };
  }

  /** Humans in join order — seat i goes to the i-th human at match start. */
  humansInJoinOrder(room: Room): Player[] {
    return [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  /** Number of bot seats once the match starts. */
  botCount(room: Room): number {
    if (!room.settings.botFill) return 0;
    return Math.max(0, room.settings.seats - room.players.size);
  }

  /** Resolve a seat index to its human player, or null for a bot seat. */
  seatPlayer(room: Room, seat: number): Player | null {
    const humans = this.humansInJoinOrder(room);
    return seat < humans.length ? humans[seat] : null;
  }

  seatName(room: Room, seat: number): string {
    const player = this.seatPlayer(room, seat);
    if (player) return player.name;
    const humans = this.humansInJoinOrder(room).length;
    return BOT_NAMES[(seat - humans) % BOT_NAMES.length] ?? `Bot ${seat + 1}`;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const abandoned =
        room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS;
      const staleLobby =
        room.status === 'lobby' &&
        room.players.size > 0 &&
        [...room.players.values()].every((p) => now - p.lastSeen > RECONNECT_GRACE_MS && !p.connected);
      if (abandoned || staleLobby) {
        room.game?.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
