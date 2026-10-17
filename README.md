# Bhabi Thulla 🃏

**🎮 Play it live: https://zunair-playground.onrender.com/bhabi-thulla**

Part of [Zunair's Playground](https://zunair-playground.onrender.com) — a growing arcade of card games.

A polished, fully responsive, **real-time multiplayer Bhabi Thulla** card game for 4–7 players. Open the link on any phone or computer, enter a nickname, host a private table, invite friends with a link or a 6-letter code, and play synchronized live matches — bots fill the empty seats so the game never waits.

**Developed by Zunair Qadeer.**

> ✅ **Status: complete and live.** All milestones shipped — game engine, practice mode, online multiplayer, production deployment.

## Features

- **Practice vs bots** — jump straight into a 4–7 seat table against smart bots, no account needed.
- **Online multiplayer** — host a private table, share an invite link (WhatsApp-friendly) or a room code; friends join from any device.
- **Smart bots** — void-aware leads: bots remember who is void in which suit and never lead into the next player's known void. Server-authoritative, so every player sees the same game.
- **Full match flow** — live trick display, turn timer with auto-play on timeout, disconnect protection (bots cover dropped players, hosts migrate), rematch, and a results screen with escape order, the Bhabi, and card counts.
- **Juicy table** — oval casino table, turn-flow arrow, card snap + Thulla sting sound effects (WebAudio synth, mutable), pause/resume, relaxed/normal/fast pacing.
- **Mobile-first** — swipeable hand strip, two-row toolbar, zero page scroll; desktop keeps the full fanned-table experience.

## How to play (the 30-second version)

Bhabi Thulla is a classic South Asian card game. One 52-card deck, no jokers, no trump — Aces high.

1. The player holding the **A♠ must open** with it (protected opening — the first trick can never Thulla).
2. The leader picks a suit; everyone else **must follow suit** if they can.
3. Can't follow? Play any card — **Thulla!** The trick ends immediately and the **highest card of the led suit picks up the whole pile** and leads next.
4. If everyone follows, the trick is discarded and the highest card leads next.
5. Empty your hand to **escape**. The last player holding cards is the **Bhabi**. 😅

Full rules contract: [`docs/RULES.md`](docs/RULES.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS, react-router |
| Game engine | Pure TypeScript (`packages/game-engine`) — rules, match state, bots; 34 Vitest tests |
| Multiplayer server | Node.js + Express + Socket.IO (`apps/server`), zod-validated protocol (`packages/protocol`) |
| Database | PostgreSQL (Neon) — match history & events; migrations run at boot |
| Hosting | **Render** — free static site (frontend, auto-deploys from GitHub) + free web service (game server) |

## Project structure

```
apps/web               React + Vite + Tailwind frontend (practice + online)
apps/server            Authoritative Socket.IO game server (rooms, bots, timers, persistence)
packages/game-engine   Pure rules engine: cards, tricks, Thulla, escapes, Bhabi, bots
packages/protocol      Shared zod command/event schemas + per-player views
apps/server/migrations Versioned SQL migrations (auto-run at server boot)
docs/RULES.md          The complete rules contract the engine implements
```

## Run it locally

```bash
# install everything (npm workspaces monorepo)
npm install

# engine tests
npm test --workspace @bhabi-thulla/game-engine

# start the game server (needs DATABASE_URL for persistence; optional)
npm run build --workspace @bhabi-thulla/server
npm run start --workspace @bhabi-thulla/server

# start the frontend (set VITE_SERVER_URL to your server in .env to play online)
npm run dev --workspace @bhabi-thulla/web
```

## Deployment

- **Frontend:** Render static site `zunair-playground` → https://zunair-playground.onrender.com (auto-deploys on push to `main`; SPA fallback `/*` → `/index.html`).
- **Game server:** Render web service `bhabi-thulla-server` → https://bhabi-thulla-server.onrender.com (auto-deploys on push; `/health` for status).
- **Database:** Neon Postgres (free tier); `DATABASE_URL` on the server.

Environment variables: `VITE_SERVER_URL` (frontend build), `CLIENT_URL`, `DATABASE_URL`, `SERVER_SECRET` (server).

---

*Built with ♠️ by [Zunair Qadeer](https://github.com/code-with-zunairqadeer) — BSCS, GCU Lahore.*
