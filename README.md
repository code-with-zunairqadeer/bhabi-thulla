# Bhabi Thulla

**Play it live:** https://zunair-playground.netlify.app/bhabi-thulla
(part of [Zunair's Playground](https://zunair-playground.netlify.app) — a growing arcade of card games)

A polished, responsive, real-time multiplayer **Bhabi Thulla** card game for 4–7 players.
Friends open a public website, enter a nickname, create or join a private table, invite
friends with a link or code, and play synchronized live matches with bots filling empty seats.

**Developed by Zunair Qadeer.**

> Status: Milestone B — the authoritative game engine (`packages/game-engine`) is
> implemented and tested. Frontend, backend, and deployment follow in later milestones.
> See `docs/RULES.md` for the rules contract.

## Architecture

- **GitHub** stores the full source (this repo).
- **Netlify** builds and hosts the browser frontend (`apps/web`).
- A separately hosted, always-on **Node.js + Socket.IO** service (`apps/server`)
  controls matches and persistent connections. Netlify Functions are deliberately
  *not* the game server.
- **PostgreSQL** stores durable state (sessions, rooms, matches, events).

```
apps/web              React + Vite + TypeScript frontend (Milestone C)
apps/server           Node + Express + Socket.IO authoritative server (Milestone D)
packages/game-engine  Pure TypeScript rules, match state, bots (done, tested)
packages/protocol     Shared command/event schemas (Milestone D)
database/migrations   Versioned SQL migrations (Milestone D)
tests/e2e             Playwright browser workflows (Milestone G)
docs/                 RULES.md, ARCHITECTURE.md, DEPLOYMENT.md, ...
```

## Quickstart (engine)

```bash
npm install
npm test --workspace @bhabi-thulla/game-engine
```

## Rules (Classic preset, v`classic-1`)

- One 52-card deck, no jokers, no trump. Rank A > K > Q > J > 10 … 2.
- Player holding the **A-spades** must open with it.
- Leader chooses the suit; others must follow suit if they can.
- A player who cannot follow may play any card — this **ends the trick immediately
  (Thulla!)**. The highest card of the led suit picks up every card in the trick
  and leads next. Later players do not play.
- If everyone follows, the trick is discarded and the highest card leads next.
- Empty-handed players are marked safe only after the trick resolves.
- When one player is left holding cards, that player is **Bhabi**.
  All hands empty together is a draw.

Full contract: [`docs/RULES.md`](docs/RULES.md). A **Protected Opening** variant
is also implemented (opening trick always completes; A-spades player leads next).

## Milestones

A. Specification · **B. Engine** ← we are here · C. Frontend practice · D. Backend ·
E. Reliability · F. UX polish · G. Validation · H. GitHub handoff · I. Deployment ·
J. Private beta

## Branding

The working product name is **Bhabi Thulla**. All branding lives in central
configuration so it can change to an owner-approved spelling later.
