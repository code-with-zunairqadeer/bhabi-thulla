-- Milestone D schema: finished matches, players, and the public event feed.
-- The live game itself runs in server memory; this is the durable record.

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  room_code TEXT NOT NULL,
  seats INT NOT NULL,
  pace TEXT NOT NULL,
  bot_fill BOOLEAN NOT NULL,
  rules_version TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  bhabi_seat INT,
  draw BOOLEAN,
  set_aside JSONB
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  seat INT NOT NULL,
  guest_id TEXT,
  name TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL,
  escaped BOOLEAN NOT NULL,
  PRIMARY KEY (match_id, seat)
);

CREATE TABLE IF NOT EXISTS match_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  event TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id, seq);
