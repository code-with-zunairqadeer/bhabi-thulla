/**
 * View builders — the only place server state becomes wire state. Every
 * view is filtered for its recipient: a socket learns its own hand and
 * everyone else's card counts, never another player's cards.
 */
import type {
  CardDTO,
  GameOverView,
  GameView,
  LobbyPlayerView,
  RoomView,
  TrickPlayDTO,
} from '@bhabi-thulla/protocol';
import type { Card } from '@bhabi-thulla/game-engine';
import type { GameController } from './game.js';
import type { Player, Room, RoomManager } from './rooms.js';

function toDTO(c: Card): CardDTO {
  return { id: c.id, suit: c.suit, rank: c.rank };
}

export function buildRoomView(room: Room, rooms: RoomManager): RoomView {
  const players: LobbyPlayerView[] = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p: Player) => ({
      guestId: p.guestId,
      name: p.name,
      seat: p.seat,
      isBot: false,
      isHost: p.guestId === room.hostGuestId,
      connected: p.connected,
    }));
  return {
    code: room.code,
    status: room.status,
    settings: { ...room.settings },
    hostGuestId: room.hostGuestId,
    players,
  };
}

export function buildGameView(
  room: Room,
  game: GameController,
  rooms: RoomManager,
  guestId: string,
  opts?: { thullaFlash?: boolean },
): GameView {
  const m = game.match;
  const player = room.players.get(guestId);
  const mySeat = player?.seat ?? null;
  const turn = m.turnSeat();
  const isMyTurn = mySeat !== null && turn === mySeat;

  let hand: CardDTO[] = [];
  let legalCardIds: string[] = [];
  if (mySeat !== null && !m.seats[mySeat].escaped) {
    hand = m.seats[mySeat].hand.map(toDTO);
    if (isMyTurn && m.phase === 'awaiting_action') {
      try {
        legalCardIds = m.legalPlays(mySeat).map((c) => c.id);
      } catch {
        legalCardIds = [];
      }
    }
  }

  const trick = m.trick;
  const plays: TrickPlayDTO[] =
    trick?.plays.map((p) => ({ seat: p.seat, card: toDTO(p.card) })) ?? [];

  return {
    code: room.code,
    phase: m.phase,
    numSeats: m.numSeats,
    mySeat,
    turn,
    turnName: turn !== null ? rooms.seatName(room, turn) : '',
    hand,
    legalCardIds,
    seats: m.seats.map((s, seat) => {
      const p = rooms.seatPlayer(room, seat);
      return {
        seat,
        name: s.name,
        isBot: s.isBot,
        connected: p ? p.connected : true,
        cardCount: s.hand.length,
        escaped: s.escaped,
      };
    }),
    trick: trick
      ? { leader: trick.leader, ledSuit: trick.ledSuit, plays }
      : null,
    completedTrick: null, // v1: clients infer trick completion from plays + turn
    thullaFlash: opts?.thullaFlash ?? game.consumeThullaFlash(),
    events: m.events.slice(-40),
    secondsLeft:
      game.turnDeadline !== null && isMyTurn
        ? Math.max(0, Math.ceil((game.turnDeadline - Date.now()) / 1000))
        : null,
    pace: room.settings.pace,
    isFirstTrick: m.isFirstTrick,
    setAsideCount: m.setAside.length,
  };
}

export function buildGameOver(
  room: Room,
  game: GameController,
  guestId: string,
): GameOverView {
  const m = game.match;
  const escapeOrder: string[] = [];
  for (const e of m.events) {
    const mm = e.match(/^(.+) escapes!$/);
    if (mm) escapeOrder.push(mm[1]);
  }
  const player = room.players.get(guestId);
  const mySeat = player?.seat ?? null;
  return {
    code: room.code,
    bhabi: m.bhabi,
    bhabiName: m.bhabi !== null ? m.seats[m.bhabi].name : null,
    youAreBhabi: mySeat !== null && m.bhabi === mySeat,
    draw: m.draw,
    escapeOrder,
    seats: m.seats.map((s, seat) => ({
      seat,
      name: s.name,
      isBot: s.isBot,
      escaped: s.escaped,
    })),
  };
}
