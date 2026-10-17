/**
 * Socket.IO wiring: token auth, validated commands, per-player broadcasts.
 * Every command is validated against its zod schema before it touches any
 * room state; failures answer the ack and never throw into the socket.
 */
import { Server, Socket } from 'socket.io';
import {
  COMMAND_SCHEMAS,
  CommandName,
  type Ack,
} from '@bhabi-thulla/protocol';
import { verifyToken } from './sessions.js';
import { RoomManager, type Room } from './rooms.js';
import { GameController } from './game.js';
import { buildGameOver, buildGameView, buildRoomView } from './views.js';

declare module 'socket.io' {
  interface SocketData {
    guestId: string;
    roomCode: string | null;
  }
}

type AckFn = (ack: Ack<unknown>) => void;

export function attachSockets(io: Server, rooms: RoomManager): void {
  // Token auth on every connection.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const guestId = verifyToken(token);
    if (!guestId) return next(new Error('Invalid or missing session token.'));
    socket.data.guestId = guestId;
    socket.data.roomCode = null;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const guestId = socket.data.guestId;

    // Reattach to a room the guest already belongs to (fresh join or
    // reconnect after a drop).
    const existing = rooms.findPlayerRoom(guestId);
    if (existing) {
      joinSocketRoom(socket, existing, rooms);
      sendRoomState(socket, existing, rooms);
      sendGameState(socket, existing, rooms);
    }

    for (const name of Object.keys(COMMAND_SCHEMAS) as CommandName[]) {
      socket.on(name, (payload: unknown, ack?: AckFn) => {
        const respond: AckFn = ack ?? (() => {});
        try {
          const parsed = COMMAND_SCHEMAS[name].safeParse(payload ?? {});
          if (!parsed.success) {
            respond({ ok: false, error: 'Invalid request.' });
            return;
          }
          handleCommand(io, rooms, socket, name, parsed.data, respond);
        } catch (e) {
          respond({ ok: false, error: e instanceof Error ? e.message : 'Request failed.' });
        }
      });
    }

    socket.on('disconnect', () => {
      const result = rooms.detachSocket(guestId);
      if (result) {
        // The table keeps playing — a bot covers the seat until they return.
        broadcastRoom(io, rooms, result.room);
        broadcastGame(io, rooms, result.room);
      }
    });
  });
}

function handleCommand(
  io: Server,
  rooms: RoomManager,
  socket: Socket,
  name: CommandName,
  payload: Record<string, unknown>,
  respond: AckFn,
): void {
  const guestId = socket.data.guestId;

  switch (name) {
    case 'cmd:create-room': {
      const { name: playerName, seats, pace, botFill } = payload as {
        name: string; seats: number; pace: 'relaxed' | 'normal' | 'fast'; botFill: boolean;
      };
      const room = rooms.create(guestId, playerName, { seats, pace, botFill });
      joinSocketRoom(socket, room, rooms);
      broadcastRoom(io, rooms, room);
      respond({ ok: true, data: { code: room.code } });
      return;
    }

    case 'cmd:join-room': {
      const { code, name: playerName } = payload as { code: string; name: string };
      const room = rooms.join(code, guestId, playerName);
      joinSocketRoom(socket, room, rooms);
      broadcastRoom(io, rooms, room);
      sendGameState(socket, room, rooms);
      respond({ ok: true, data: { code: room.code } });
      return;
    }

    case 'cmd:leave-room': {
      const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
      socket.leave(socket.data.roomCode ?? '');
      socket.data.roomCode = null;
      if (room) {
        rooms.leave(room.code, guestId);
        broadcastRoom(io, rooms, room);
        broadcastGame(io, rooms, room);
      }
      respond({ ok: true });
      return;
    }

    case 'cmd:update-settings': {
      const room = requireRoom(rooms, socket);
      if (room.hostGuestId !== guestId) throw new Error('Only the host can change settings.');
      if (room.status !== 'lobby') throw new Error('Settings are locked once the match starts.');
      const { seats, pace, botFill } = payload as {
        seats?: number; pace?: 'relaxed' | 'normal' | 'fast'; botFill?: boolean;
      };
      if (seats !== undefined) {
        if (seats < room.players.size) throw new Error('Seats cannot go below the player count.');
        room.settings.seats = seats;
      }
      if (pace !== undefined) room.settings.pace = pace;
      if (botFill !== undefined) room.settings.botFill = botFill;
      broadcastRoom(io, rooms, room);
      respond({ ok: true });
      return;
    }

    case 'cmd:start-match': {
      const room = requireRoom(rooms, socket);
      if (room.hostGuestId !== guestId) throw new Error('Only the host can start the match.');
      if (room.status !== 'lobby') throw new Error('The match has already started.');
      if (room.players.size < 1) throw new Error('Nobody is here yet.');
      // No ready-ups: whoever is in the room plays, bots fill the rest.
      startMatch(io, rooms, room);
      respond({ ok: true });
      return;
    }

    case 'cmd:play-card': {
      const room = requireRoom(rooms, socket);
      const game = room.game;
      if (!game || room.status !== 'playing') throw new Error('No live match at this table.');
      const player = room.players.get(guestId);
      if (!player || player.seat === null) throw new Error('You are not seated at this table.');
      const { cardId, actionId } = payload as { cardId: string; actionId: string };
      const seat = player.seat;
      if (game.match.turnSeat() !== seat) throw new Error('Not your turn.');
      const res = game.playCard(seat, cardId, actionId);
      if (!res.ok) throw new Error(res.error ?? 'Illegal play.');
      respond({ ok: true });
      return;
    }

    case 'cmd:rematch': {
      const room = requireRoom(rooms, socket);
      if (room.hostGuestId !== guestId) throw new Error('Only the host can call a rematch.');
      if (room.status !== 'finished') throw new Error('Finish the current match first.');
      room.game?.destroy();
      room.game = null;
      room.status = 'lobby';
      for (const p of room.players.values()) {
        p.seat = null;
      }
      broadcastRoom(io, rooms, room);
      respond({ ok: true });
      return;
    }
  }
}

function requireRoom(rooms: RoomManager, socket: Socket): Room {
  const code = socket.data.roomCode;
  const room = code ? rooms.get(code) : undefined;
  if (!room) throw new Error('You are not at a table.');
  return room;
}

function joinSocketRoom(socket: Socket, room: Room, rooms: RoomManager): void {
  if (socket.data.roomCode && socket.data.roomCode !== room.code) {
    socket.leave(socket.data.roomCode);
  }
  socket.join(room.code);
  socket.data.roomCode = room.code;
  rooms.attachSocket(room, socket.data.guestId, socket.id);
}

function startMatch(io: Server, rooms: RoomManager, room: Room): void {
  room.status = 'playing';
  const game = new GameController(room, rooms, {
    broadcast: () => broadcastGame(io, rooms, room),
    sendGameOver: () => sendGameOver(io, rooms, room),
  });
  room.game = game;
  broadcastRoom(io, rooms, room);
  game.start();
  broadcastGame(io, rooms, room);
}

/** Emit room:update to every connected member of the room. */
export function broadcastRoom(io: Server, rooms: RoomManager, room: Room): void {
  const view = buildRoomView(room, rooms);
  for (const player of room.players.values()) {
    if (player.socketId) io.to(player.socketId).emit('room:update', view);
  }
}

/** Emit a per-player filtered game:state to every connected member. */
export function broadcastGame(io: Server, rooms: RoomManager, room: Room): void {
  const game = room.game;
  if (!game) return;
  // One flash per broadcast round — every player sees it, then it clears.
  const flash = game.peekThullaFlash();
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    try {
      io.to(player.socketId).emit(
        'game:state',
        buildGameView(room, game, rooms, player.guestId, { thullaFlash: flash }),
      );
    } catch {
      // A single bad view must never break the table for everyone else.
    }
  }
  game.clearThullaFlash();
}

function sendRoomState(socket: Socket, room: Room, rooms: RoomManager): void {
  socket.emit('room:update', buildRoomView(room, rooms));
}

function sendGameState(socket: Socket, room: Room, rooms: RoomManager): void {
  const game = room.game;
  if (!game) return;
  socket.emit('game:state', buildGameView(room, game, rooms, socket.data.guestId));
}

function sendGameOver(io: Server, rooms: RoomManager, room: Room): void {
  const game = room.game;
  if (!game) return;
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit('game:over', buildGameOver(room, game, player.guestId));
  }
}
