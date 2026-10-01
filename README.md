# Stew Zombies

An original round-based zombies game for the browser. Everything you see and
hear (models, textures, sounds) is generated in code. The only library is
[three.js](https://threejs.org) (r160), loaded from a CDN.

**Current phase: 6 — power-ups and Cheddar Rounds.**

- **Power-ups** drop from zombies you kill inside the map (up to 4 a round,
  more likely as your points add up). Walk over one to grab it; they blink and
  vanish after 30 seconds.

  | Power-up | What it does |
  |---|---|
  | Full Pantry | all ammo and grenades refilled, for everyone |
  | One Bite | everything dies in one hit for 30 s |
  | Double Dough | double points for 30 s |
  | Pressure Cooker | every zombie on the map dies, +400 points |
  | Shop Class | every barrier rebuilt, +200 points |
  | Clearance Sale | the Mystery Box costs 10 for 30 s |

- **Cheddar Rounds:** the first lands on round 5, 6 or 7, then every 4–6
  rounds. A yellow haze rolls in, thunder rumbles, and Erik's rabid hounds
  (Cheddars) come down with lightning strikes near you instead of zombies.
  They're fast and bite hard. The last one killed leaves a Full Pantry.

Phases 4 & 5 (built):

- **The map:** two paths from the court meet in the auditorium. The west path
  runs through the locker rooms, science lab, library and band & art rooms,
  with the boiler room off the locker rooms. The east path runs through the
  cafeteria, kitchen and loading dock. **The Quad** is an outdoor courtyard
  for running trains around a dead fountain. Zombies climb its fence and claw
  up out of the planters.
- **Power:** throw the lever in the boiler room. The lights come on in a wave
  across the school, and the perks, traps and Mad Dog Machine wake up.
- **Electric traps (1000):** on the locker room → science lab door and the
  kitchen → loading dock door.
- **Perks** (max 4, lost when you go down):

  | Perk | Where | Cost | What it does |
  |---|---|---|---|
  | Second Helping | court | 500 (1500 co-op) | Solo: get back up on your own (3 uses). Co-op: revive twice as fast. Works without power. |
  | Beefcake Broth | cafeteria | 2500 | 250 health instead of 100 |
  | Hot Pot Hustle | science lab | 3000 | Reload twice as fast |
  | Double Ladle | band room | 2000 | Fire 33% faster, every bullet hits twice as hard |
  | Marathon Minestrone | auditorium | 2000 | Sprint almost forever, move a little faster |

- **Mad Dog Machine (5000)**, center stage in the auditorium: feed it the gun
  in your hands and it comes back upgraded. It gets double damage, bigger
  mags, more ammo, a new name and a glowing claw-slash camo. Upgraded ammo
  off the wall costs 4500.
- **Last stand:** at zero health you drop with a pistol. Solo, you need
  Second Helping to get back up; in co-op a teammate holds F on you before you
  bleed out (30 s).

## Mad Dog upgrades

| Weapon | Upgraded name | Damage per bullet (or pellet) |
|---|---|---|
| M1912 | **Twin Stewpots** | 120 dmg, dual, explosive rounds |
| M15 | **Detention Hammer** | 220 dmg |
| Olympus | **Wrath of Olympus** | 150 dmg |
| MP41 | **Last Call** | 76 dmg |
| Pyton | **Venom King** | 450 dmg |
| Komando | **Warmonger** | 160 dmg |
| Staykout | **Riot Act** | 180 dmg |
| MP6K | **Hornet's Nest** | 80 dmg |
| MPK | **Buzzsaw Betty** | 76 dmg |
| PM64 | **Pocket Apocalypse** | 64 dmg |
| AK-75u | **Siberian Howl** | 112 dmg |
| M17 | **Triple Threat** | 144 dmg |
| CZ76 | **Crimson Viper** | 124 dmg |
| CZ76 Dual Wield | **Viper Twins** | 124 dmg |
| Spectur | **Phantom Shredder** | 92 dmg |
| FAMOS | **Burnout** | 140 dmg |
| AWG | **Grim Overseer** | 164 dmg |
| Galill | **Desert Dirge** | 184 dmg |
| G12 | **Caseless Carnage** | 168 dmg |
| SPAZ-13 | **Bloodbath 13** | 190 dmg |
| HS11 | **Dead Ringers** | 165 dmg |
| HK22 | **Steel Hurricane** | 224 dmg |
| RPKK | **Iron Tsunami** | 192 dmg |
| Dragunoff | **Cold Verdict** | 1050 dmg |
| L97A1 | **Final Exam** | 3300 dmg |
| China Pond | **Doomsday Dragon** | bigger blast |
| Kross-Bow | **Hellhound's Fang** | bigger blast, 360 on impact |
| Ballistik Knife | **Soul Splitter** | 1950 per blade, 3x knife |

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

## Firing Range

Pick **Firing Range** on the title screen to try every weapon without rounds.
You're in the JROTC range under the school: target dummies stand at 5 to 50 m
and get back up a moment after they die, and you can't die. Press **B** to open
the weapons & options panel:

- Click any of the 28 weapons to take it (fills your empty slot, or replaces the one in your hands).
- Zombie strength sets the dummies' health to any round's (1–50).
- Infinite ammo, moving targets, send a horde at that round's strength, clear zombies.
- **Mad Dog upgraded** switches every gun in the list to its upgraded version.
- Perk buttons switch each perk on or off instantly.
- Drop any power-up in front of you, or send a pack of Cheddars.

The top-left readout shows the gun's stats, last hit, damage per second, time
to kill, accuracy and kills, and damage numbers float off every hit (gold for
headshots, orange for explosions, red for the killing blow). The Mystery Box
and a frag wall buy are in the armory behind the firing line; you have 50,000
points to spend there.

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
  range.js            firing range mode: target dummies, hordes, infinite ammo
  perks.js            perk effects, buying (and drinking), losing them
  laststand.js        going down, last stand pistol, self-revive, bleed out, revive
  powerups.js         drops, pickups and timed power-up effects
  physics.js          character vs box collision, steps, gravity
  nav.js              region/portal pathing between rooms (closed doors block)
  interactables/      windows, doors & debris, wall weapons, mystery box,
                      power switch, perk machines, Mad Dog Machine, traps, revive

src/map/              map data (school.js, range.js: rooms, windows, doors, props, nav) + builder
src/render/           three.js views: map, zombies, viewmodel, camera, effects, post
src/audio/            Web Audio engine, synthesized sounds, event → sound director
src/input/            keyboard/mouse → per-tick input commands
src/ui/               HUD (tally marks, points, ammo), menus, settings, firing range panel
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
4. ✅ Rest of the map, second path, boiler room, auditorium, **the Quad courtyard**, electric traps, power switch (see [docs/MAP_DESIGN.md](docs/MAP_DESIGN.md))
5. ✅ Perk machines, Mad Dog Machine, last stand and revive
6. ✅ Power-ups and Cheddar Rounds
7. Fucci Gun, The Chopper, Stew Bomb, box movement (including a fifth box spot in the Quad)
8. Erik's PA taunts and intercom, the hidden Stew song Easter egg, lore, menus, full visual and sound polish
9. Online co-op for 2–4 players
