# Stew Zombies

An original round-based zombies game for the browser. Everything you see and
hear (models, textures, sounds) is generated in code. The only library is
[three.js](https://threejs.org) (r160), loaded from a CDN.

**Current phase: 3 — Every weapon, grenades and explosives.** All 28 guns
from the spec, each with its own model, recoil, reload and sound: pump and
bolt actions, shell-by-shell shotgun reloads, belt-fed LMGs, scoped snipers,
dual-wield pistols and shotguns, burst fire, a grenade launcher, an explosive
crossbow and a ballistic knife. Frag grenades (cook them, but not too long),
explosions that blow zombies apart or leave them crawling. New guns come from
the Mystery Box and the wall weapons already in the map (Phase 4 puts the
rest of the wall weapons in their rooms).

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
| Mouse | Look · left click fires · right click aims down sights (or fires the left gun when dual wielding) |
| Shift (hold) | Sprint (can't fire; short delay after you stop) |
| Space · C | Jump · crouch |
| R | Reload (sprinting cancels it; firing cancels a shotgun's shell reload) |
| G | Frag grenade: hold to cook, release to throw. You start with 2 and are topped back up every round; the wall buy (250) raises that to 4 |
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
  weapons.js          firing, spread, recoil, every reload style, ADS, scope sway,
                      dual wield, burst, grenades, knife + lunge
  projectiles.js      thrown/fired projectiles (frags, launcher rounds, bolts, blades), explosions
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
tests/                headless tests: node tests/sim_headless.mjs, phase2_headless.mjs, phase3_headless.mjs
```

The simulation only takes **input commands** and produces **state + events**.
Rendering, audio and the HUD just read those. That separation is what lets
online co-op drop in later (see `src/net/README.md`).

In the browser console, `STEW.sim` is the live game state and
`STEW.debug.run(seconds)` fast-forwards the simulation.

## Map design

The layout rules and the plan for the whole school (two paths, training spots,
what each room offers) are in [docs/MAP_DESIGN.md](docs/MAP_DESIGN.md).

## Build plan

1. ✅ Movement, camera, controls, M1912, knife, zombies, rounds, points, windows (basketball court)
2. ✅ Main hallway, cafeteria, front office, doors, first wall weapons, mystery box
3. ✅ Full weapon list, recoil/reload/sound per gun, grenades
4. Rest of the map, second path, boiler room, auditorium, **the Quad courtyard**, electric traps, power switch (see [docs/MAP_DESIGN.md](docs/MAP_DESIGN.md))
5. Perk machines, Mad Dog Machine, last stand and revive
6. Power-ups and Cheddar Rounds
7. Fucci Gun, The Chopper, Stew Bomb, box movement (including a fifth box spot in the Quad)
8. Erik's PA taunts and intercom, the hidden Stew song Easter egg, lore, menus, full visual and sound polish
9. Online co-op for 2–4 players
