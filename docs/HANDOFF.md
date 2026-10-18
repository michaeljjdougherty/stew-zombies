# Stew Zombies: handoff for a new Claude thread

Read this first, then the README (it covers every map and system, including
2.0, and the code layout). This file covers the way of working that only lived
in the old chat. Last updated October 16, 2026 (commit after `d68ccf2`).

## What it is

A Call of Duty Zombies–style browser game in three.js (plain ES modules, no
build step), by **Michael Dougherty** and **James Amarante** (GitHub
`jjamarant-lang`). Branded **Stew Zombies 2.0**.

- **Live site:** https://michaeljjdougherty.github.io/stew-zombies/ (GitHub Pages, `master`).
- **Claude artifact copy:** https://claude.ai/artifact/1BhsdQeps2VW7GNWsst9zG (v86 = `d68ccf2`).
- **Michael's local clone:** `~/Documents/stew-zombies` on his Mac. He pushes with GitHub Desktop (Push origin). James pushes too, so pull before starting.

## What's built

**Map 1: Stew Leonard High** (story by James). It's the original school map, with every system in the README. That includes:

- perks, the Mad Dog upgrade machine, the box, traps and power-ups;
- Erik on the PA;
- the Stew song Easter egg and the full quest;
- online co-op for 2–4 players (PeerJS/WebRTC, host-authoritative).

**Map 2: Call of the Crust** (story by Michael). The files are `src/map/crust*.js`, `src/render/crust*.js` and `src/sim/crustEgg.js`/`crustPower.js`.

- **The world:** five floating islands in space. The Anvil is the hub; the others are the Ship Graveyard, Research Base, Trench Front and Ice Caves. Each has its own dead, mist and particles.
- **Getting around:** launch pads (30 s recharge), ziplines, ice slides, dolphin dive and prone.
- **Power:** it starts dead. Blown relays go to Pit, and each island has its own switch and perk machine.
- **The egg:** four War Hammer parts at shrines are built at the Anvil, then given elemental cores and tempered by Pit. There are four titans, and the boss is Big Evil Zach, whose fight plays the L4D "Tank" song.
- **Story and dialogue:** intro and ending cutscenes, the Schnitz's cage with Chops, Regs and P, and about 570 Crust voice lines.
- **Weapons and items:** the M2 Flamethrower, Maisy Dog, LBD, Milton Kick (a third weapon slot), and seven newer guns.
- **Locked for now:** the Crust is behind a **developer code** that only Michael and James have (`DEV_CODE` in `src/ui/mapselect.js`; online, the host needs it to pick the map). Online it's labelled **beta**.

**Systems added in 2.0:**

- **Careers:** usernames with 4-digit PINs, stats, and Xbox-style achievements. The code is in `src/career/` and uses Firebase Realtime DB + Auth over REST, with no SDK. The DB is `stew-zombies-default-rtdb`, and its rules only let the career's own auth uid write. The web API key in `config.js` is public by design.
- **GobbleGum:** all 64 Black Ops 3 gums.
  - Players build a pack of 5. Machines stand next to the perk machines (free, then 1000, then 2000 points, 3 a round), and [H] / D-pad ↓ activates a gum. It works online.
  - Liquid Divinium is earned by playing and saved to the username.
  - **Dr. Monty's Factory** (`src/ui/factoryUI.js`) uses three vats and buttons 1–3. The deals are in `CONFIG.gobblegum.factory.vats`.
  - The machines use a real gumball-machine model, and every gum has a canvas-drawn BO3-style logo (`src/render/gumIcons.js`).
- **The 2.0 main menu:** Xbox 360-style "blades" (Play, GobbleGum, Extras, Settings), styled as **charred book pages** with ember edges. Behind them the title pans the Crust.
- **Music:** the menu plays The Kettle Liturgy. Settings › Menu music brings back the original theme.
- **Sounds and trailer:** the recorded sounds come in a pack (`assets/sfx/guns_pack.mp3`, built by `tools/pack-sounds.mjs` from `sfx-src/guns/`). The in-engine trailer has a graphics picker.
- **Performance:**
  - far-off details are culled (`graphics.farCull`);
  - still scenery is merged into a few big meshes (`mergeStatic`);
  - characters draw once per material (`rigidSkin`).

## Rules we work by

- **Modular code.** Every tunable number goes in `src/config.js`. The sim (`src/sim/`) never touches three.js, the DOM or audio; it only takes commands and emits events.
- **Commit after each step**, with a message that says what the player will notice.
- **Run the headless tests** (`node tests/<name>_headless.mjs`; there are 42) before pushing. `tests/syntax_headless.mjs` catches a file that won't parse, which stops the whole game loading. If a change touches `sim.rng`, check the Crust and school tests, because new random draws shift everything after them.
- **Update the patch notes** (`src/ui/patchNotes.js`) for anything players will notice. Use plain, non-technical language.
- **Never kill processes by pattern** (`pkill -f`); kill by PID. Read a file before deleting it.
- **The Crust stays behind the dev code** until Michael says to release it. The code is checked in the browser, so anyone who reads the JS can find it. It keeps out casual players, not determined ones.

## Publishing the artifact (only one thread at a time)

1. `node tools/build-artifact.mjs` writes `dist/artifact.html`. It also writes base64 `.json` copies of `.glb`/`.bin` files, because the artifact host won't serve those types.
2. Before publishing, read the published copies of the files you changed and compare them with the last published commit. Someone else may have published in between.
3. Publish `dist/artifact.html` with `root` = the repo and a `files` map holding only the changed files (`null` removes a file).
4. **Hard limit: 512 files per artifact.** It currently has about 440. To make room, pack small files together, as with the gun sounds, rather than adding many new ones.

## Known quirks

- **Headless screenshots are very slow.** SwiftShader takes about 4 seconds a frame, so CSS transitions look frozen in screenshots. That's the test environment, not a bug.
- **Hotspot files** that most work touches: `index.html` (all markup and CSS), `src/config.js`, `src/main.js`, `src/audio/director.js`, `src/sim/sim.js` and `src/ui/patchNotes.js`. Parallel threads will conflict here, so keep each one's edits small and pull often.

## Threads that can run side by side

Run two or three at a time. Give each one its own area of the code, and let
only one thread publish the artifact or push at a time.

| Thread | Owns | Notes |
| --- | --- | --- |
| **Call of the Crust release** | `src/map/crust*`, `src/render/crust*`, `src/sim/crustEgg.js`, `crustPower.js`, `src/net/` | Playtest fixes, balance, taking online out of beta. Michael decides when the dev-code lock comes off. |
| **Menus and UI** | `index.html` (markup and CSS), `src/ui/` | Only one thread at a time should edit `index.html`. |
| **Weapons** (tweaks and new guns) | the `weapons` section and the class defaults at the top of `src/config.js`, plus the `recoil`, `madDog` and `aat` sections; `src/sim/weapons.js`; `src/render/gunModels.js` and `viewmodel.js`; `src/audio/gunSamples.js` | Try changes in the Firing Range. Tests: `newguns`, `phase3`, `ads`, `range`. On the Crust each wall gun appears only once and the box contents differ, so check balance on both maps. Keep all gun work in this one thread. |
| **Audio** | `src/audio/` (except `gunSamples.js`), `assets/sfx`, `assets/music`, `assets/voice` | Fairly independent of the other threads. |
| **Performance** | `src/render/` (not the Crust files), `src/render/quality.js`, the `graphics` section of `config.js` | Overlaps with the Crust visuals, so run it after the Crust thread or stay out of the Crust files. |
| **Docs** | `README.md`, `docs/` | Never conflicts with anything. |

Other new content (gums, perks, power-ups) goes through `config.js` and the
sim. Do those one at a time. Git merges line by line, so two threads editing
different sections of `config.js` won't conflict; two threads editing the same
lines will.

## Ideas on the table (not built yet)

- Releasing the Crust publicly (removing the dev-code lock), and taking its online play out of beta.
- Giving the other menus (pause, settings, map select, the pack screen, game over) the same charred-book look as the title.
