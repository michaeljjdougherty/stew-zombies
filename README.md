# Stew Zombies

An original round-based zombies game for the browser. Everything you see and
hear (models, textures, sounds) is generated in code. The only library is
[three.js](https://threejs.org) (r160), loaded from a CDN.

**Current phase: 2 — Court, main hallway, cafeteria, front office.** Buyable
doors and debris, zone-based spawning, zombies that path between rooms, two
weapon slots, wall weapons (M15, Olympus, MP41) and the Mystery Box in the
main hallway (it can also give the Pyton and Komando ahead of Phase 3).

## Run it

It's plain ES modules, so any static file server works (opening the file
directly won't, because browsers block modules from `file://`).

```bash
cd stew-zombies
python3 -m http.server 8000
# then open http://localhost:8000
```

Click **Play**. The game captures your mouse; press **Esc** to pause.

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look · left click fires · right click aims down sights |
| Shift (hold) | Sprint (can't fire; short delay after you stop) |
| Space · C | Jump · crouch |
| R | Reload (sprinting cancels it) |
| V or E | Knife (lunges at nearby zombies) |
| F | Buy doors, debris, wall weapons and the Mystery Box |
| F (hold) | Rebuild a window barrier, one plank at a time |
| 1 · 2 · mouse wheel | Switch between your two weapons |
| Esc | Pause / settings (sensitivity, aiming sensitivity, FOV, volume…) |

## Tweaking balance and feel

Every number that affects feel or balance is in **`src/config.js`**: door and
box prices, box odds, movement
and sprint speeds, jump height, acceleration, head bob, recoil, spread, zombie
speeds and health curve, round sizes, point values, board timings, weapon
stats, post-processing strength, audio levels. Change a value, refresh.

## Code layout

```
index.html            page, HUD and menu markup, styles, import map
src/config.js         all tunable numbers
src/main.js           wires everything together; fixed-step game loop

src/sim/              GAME LOGIC — no three.js, no DOM, no audio
  sim.js              GameSim: state, step(dt), events, hitscan, snapshot()
  player.js           movement, sprint/stamina, health, interaction
  weapons.js          firing, spread, recoil, reloads, ADS, knife + lunge
  zombies.js          spawning, windows, climbing, chasing, attacks, damage
  rounds.js           round counts, spawn pacing, intermissions
  physics.js          character vs box collision, steps, gravity
  nav.js              region/portal pathing between rooms (closed doors block)
  interactables/      windows, doors & debris, wall weapons, mystery box

src/map/              map data (school.js: rooms, windows, doors, props, nav) + builder
src/render/           three.js views: map, zombies, viewmodel, camera, effects, post
src/audio/            Web Audio engine, synthesized sounds, event → sound director
src/input/            keyboard/mouse → per-tick input commands
src/ui/               HUD (tally marks, points, ammo), menus, settings
src/net/              notes for online co-op (Phase 9)
tests/                headless tests: node tests/sim_headless.mjs, node tests/phase2_headless.mjs
```

The simulation only takes **input commands** and produces **state + events**.
Rendering, audio and the HUD just read those. That separation is what lets
online co-op drop in later (see `src/net/README.md`).

In the browser console, `STEW.sim` is the live game state and
`STEW.debug.run(seconds)` fast-forwards the simulation.

## Build plan

1. ✅ Movement, camera, controls, M1912, knife, zombies, rounds, points, windows (basketball court)
2. ✅ Main hallway, cafeteria, front office, doors, first wall weapons, mystery box
3. Full weapon list, recoil/reload/sound per gun, grenades
4. Rest of the map, second path, boiler room, auditorium, power switch
5. Perk machines, Mad Dog Machine, last stand and revive
6. Power-ups and Cheddar Rounds
7. Fucci Gun, The Chopper, Stew Bomb, box movement
8. Erik's PA taunts, lore, menus, full visual and sound polish
9. Online co-op for 2–4 players
