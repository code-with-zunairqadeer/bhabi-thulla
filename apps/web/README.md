# apps/web

React + Vite + TypeScript frontend — **Milestone C: frontend practice**.

A complete playable match against the local game engine: enter a nickname,
pick 4–7 seats and a bot difficulty, then play a full match with 3–6 bots.
Your hand at the bottom (tap to select, then Play), opponents across the top,
live trick area, 30-second turn timer with auto-play on timeout, Thulla
banners, action feed, and a results screen with escape order and rematch.

The engine is imported from `@bhabi-thulla/game-engine` via a Vite/TS alias
to its TypeScript source — no engine build step needed during development.

```bash
# from the repo root
npm install
npm run dev --workspace @bhabi-thulla/web     # local play at http://localhost:5173
npm run build --workspace @bhabi-thulla/web   # production build -> dist/
```

Netlify builds this workspace and publishes `apps/web/dist` (see root `netlify.toml`).
The online multiplayer lobby/rooms arrive with the authoritative server in Milestone D.
