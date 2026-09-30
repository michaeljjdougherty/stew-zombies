# Online co-op (Phase 9) — plan

The game is already split so co-op doesn't require a rewrite:

- `GameSim` (src/sim) is the single source of truth. It never touches three.js,
  the DOM or audio, so it can run in a browser tab (peer host) or in Node
  (dedicated WebSocket server) unchanged.
- Each player is driven by an **input command** per tick (`emptyCommand()` in
  `src/sim/player.js`): movement, look angles, buttons. The local keyboard is
  just one source of commands.
- The sim emits **events** (`shot`, `zombieHit`, `boardTorn`, `roundStart`, …)
  that drive effects, sounds and the HUD on every client.
- `sim.snapshot()` returns a plain-object view of the world for syncing.
- The sim uses a seeded RNG (`src/core/rng.js`) rather than `Math.random`.

## Host-authoritative model

1. One machine hosts: either a player's browser (WebRTC data channels) or a
   small Node server (`ws`). The host runs `GameSim` at 60 Hz.
2. Clients send their input command every tick (with a sequence number).
3. The host applies commands with `sim.setInput(playerId, cmd)`, steps, and
   broadcasts ~20 snapshots/s plus the event list.
4. Clients render other players and zombies by interpolating between
   snapshots, and predict their own movement locally (re-running
   `updatePlayer` from the last acknowledged state) for responsive controls.
5. Shots: clients send the shot in their command; the host resolves hits
   (optionally with small lag compensation by rewinding zombie positions).

Zombie counts already scale with player count (`CONFIG.rounds.extraPlayerMult`),
and Cheddar counts will too.
