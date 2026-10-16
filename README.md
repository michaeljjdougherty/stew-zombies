# Stew Zombies 2.0

> **Picking this up in a new Claude thread?** Read [docs/HANDOFF.md](docs/HANDOFF.md) first: how we work, which threads can run side by side, publishing the artifact, and what's next.

An original round-based zombies game for the browser, made by **Michael
Dougherty** and **James Amarante** for the Stew crew. The only library is
[three.js](https://threejs.org) (r160), loaded from a CDN: plain ES modules, no
build step.

**Play it:** https://michaeljjdougherty.github.io/stew-zombies/ (GitHub Pages,
served from `master`).

## What's in 2.0

- **Two maps, two writers.** [Stew Leonard High](#map-1-stew-leonard-high)
  (story by James) and [Call of the Crust](#map-2-call-of-the-crust) (story by
  Michael). The Crust is still behind a developer code.
- **A new main menu:** four Xbox 360-style blades (Play, GobbleGum, Extras,
  Settings) drawn as the charred pages of an old book, with the Crust slowly
  panning behind them and The Kettle Liturgy playing.
- **[Careers](#careers-and-achievements):** sign in with a username and a
  4-digit PIN; your stats and achievements follow you to any computer.
- **[GobbleGum](#gobblegum):** all 64 Black Ops 3 gums, Liquid Divinium and
  Dr. Monty's Factory.
- **Alternate ammo** on Mad Dog'd guns, two new perks (PHD Gaylor and Milton
  Kick, a third weapon slot), dolphin dive and prone, new guns and new
  equipment.
- **Online co-op** for 2–4 players on both maps (the Crust is in beta online).
- **Smoother:** graphics presets, auto resolution, and a lot less drawn every
  frame.

## Run it

It's plain ES modules, so any static file server works (opening the file
directly won't, because browsers block modules from `file://`).

```bash
cd stew-zombies
python3 -m http.server 8000
# then open http://localhost:8000
```

No Python? On Windows, `powershell -ExecutionPolicy Bypass -File serve.ps1`
does the same thing.

The game opens on the Tiger Fish Interactive logo (click or press a key: that
lets the browser start the sound), asks who's playing, then shows the menu.
The game captures your mouse; press **Esc** to pause.

### Keyboard and mouse

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look · left click fires · right click aims down sights (or fires the left gun when dual wielding) |
| Shift (hold) | Sprint (can't fire; short delay after you stop) |
| Space | Jump (and let go of a zipline) |
| C | Crouch · hold to go prone · press while sprinting to dolphin dive |
| R | Reload (sprinting cancels it; firing cancels a shotgun's shell reload) |
| G | Frag grenade: hold to cook, release to throw. You start with 2 and are topped back up every round; the wall buy (250) raises that to 4 |
| Q | Your tactical: Stew Bombs or Maisy Dogs |
| X | Set down an LBD |
| H | Use your GobbleGum |
| V or E | Knife (lunges at nearby zombies) |
| F | Buy and use: doors, debris, wall weapons, the Mystery Box, perks, gum machines, launch pads, ziplines |
| F (hold) | Rebuild a window barrier, one plank at a time; revive a teammate |
| 1 · 2 · 3 · mouse wheel | Switch weapons (3 with Milton Kick) |
| Tab (hold) | Scoreboard: points, kills, headshots, downs and revives for everyone |
| B | Explore: the Explore menu · Firing Range: the weapons panel |
| Esc | Pause / settings |

### Controller

Plug in (or pair) an Xbox or PlayStation controller and press any button. Every
button prompt in the game switches to that controller (Xbox letters or
PlayStation shapes), and back to keys as soon as you touch the keyboard or
mouse. Settings → Button prompts can force Xbox or PlayStation icons.

| Xbox | PlayStation | Action |
| --- | --- | --- |
| Left stick · L-click | Left stick · L3 | Move · sprint (toggle) |
| Right stick · R-click | Right stick · R3 | Look · knife |
| RT · LT | R2 · L2 | Fire · aim down sights |
| A · B | ✕ · ○ | Jump · crouch (toggle; hold for prone, press while sprinting to dive) |
| X | □ | Buy / use (hold to rebuild or revive); reload when there's nothing to buy |
| Y | △ | Switch weapons |
| RB · LB | R1 · L1 | Frag grenade (hold to cook) · tactical |
| D-pad ↓ | D-pad ↓ | Use your GobbleGum |
| Menu | Options | Pause |
| View (hold) | Create (hold) | Zombies: scoreboard · Firing Range: weapons panel · Explore: the menu |

Menus: D-pad or left stick to move, A/✕ to select, B/○ to go back, D-pad
left/right for sliders, LB/RB (L1/R1) to flip the title's blades, tabs, shirt
colours or lineup characters, right stick to turn characters or scroll.
Settings has controller look speed, aim assist and vibration.

## The main menu

The title is four **blades**, the burnt pages of an old book with smouldering
edges and embers, over a slow flight round the Crust. Flip between them with
the arrow keys, the bumpers or a click.

- **Play:** Play (the [map select](#map-select)), Play Online, Firing Range,
  Explore, and Characters.
- **GobbleGum:** build your pack of 5, and Dr. Monty's Factory.
- **Extras:** Career & Achievements, the Call of the Crust trailer (pick its
  graphics first: Low to Ultra), and Story, Notes & More (story, notes found,
  how to play, the jukebox, credits, patch notes).
- **Settings:** the full settings, switch username, and the controls.

The menu music is **The Kettle Liturgy**; Settings › Menu music brings back
the original title theme.

### Map select

**Play** opens a star chart (`src/ui/mapselect.js`). Since the end of The
Final Whistle the campus sits on an asteroid in deep space, so each map is its
own world: Stew Leonard High on its rock (drawn to scale from the real level,
with its rooms named when you zoom in close, and Brian's portal just off the
edge), Call of the Crust at the end of a dotted route from the portal, and
planets with a hint each for the maps still to come. Drag it, scroll or pinch
to zoom. "Play the intro first" is ticked until you've seen a map's intro.

Each map can be played on **Walkthrough** (the Easter egg's objective and
how-to hints on screen) or **Hardcore** (classic zombies: no objective, no
hints). The choice is saved per browser.

### Characters

Main menu → Characters: the model on a turntable under a spotlight (drag to
spin), and *See the whole crew* for the lineup (drag to turn them, pick a name
to fly over, Face to zoom in). Playable: **Kearns** (with his four T-shirt
colours), **Ryan**, **Pit** and **Rocco**. **Brian** unlocks when you finish
The Final Whistle. After that **Zach** shows up as missing, and he's playable
once you free him on Call of the Crust. Pit isn't playable on the Crust: he's
at his forge.

## Map 1: Stew Leonard High

*Out of Bounds*, story by James Amarante. The undefeated Stew Leonards cut
Erik Madsen (#8) right before the championship. He sold his soul to The
Schnitz, and at tip-off he stripped the team of their talent and raised the
dead on Stew Leonard High. He's sealed in the metal-clad Press Box over center
court. The story text lives in `src/lore/erik.js`.

### The school

Two paths from the basketball court meet in the auditorium. The west path runs
through the locker rooms, science lab, library and band & art rooms, with the
boiler room off the locker rooms. The east path runs through the cafeteria,
kitchen and loading dock. **The Quad** is an outdoor courtyard for running
trains around a dead fountain; zombies climb its fence and claw up out of the
planters. The layout rules are in [docs/MAP_DESIGN.md](docs/MAP_DESIGN.md).

- **Power:** throw the main breakers in the cafeteria and the science lab. The
  lights come on in a wave and the perks, traps and Mad Dog Machine wake up.
- **Electric traps (1000):** on the locker room → science lab door and the
  kitchen → loading dock door.
- **The Mystery Box** moves after 5–9 pulls: it lands on Erik's bobblehead,
  you get your points back, it laughs at you, and it flies off to one of five
  spots (the main hallway, the Quad, the loading dock, the library or the
  auditorium). Follow the blue light.
- **The jukebox** in the Teachers' Lounge: press F for "We Go Stewie", again
  for "That's That Marmaduke", again to stop. Everyone online hears it.
- **The boiler room cauldron:** shoot its three red valves open and it boils
  over: 1000 points for everyone and a Double Dough.
- **Set dressing:** the Press Box over a blood-streaked court, fiberglass
  dairy cows, a rotting animatronic cow band on the cafeteria stage, the
  store-style cafeteria marquee and the Rule #1 rock in the Quad
  (`src/render/storyProps.js`).

### Erik on the PA

Erik reacts to the game over the PA (the intro, milestone rounds, Cheddar
Rounds, the power, the box moving, you going down, multi-kills, game over) and
throws in the odd barb when it's quiet. Each line starts with the school chime,
plays through the speakers in every room (their red light flickers while he
talks) and shows as a subtitle. Press F at the PA handset in the Teachers'
Lounge to talk back: eight scripted exchanges, then he tells you to stop
pressing the button.

Eight **notes** around the school (the championship program, the coach's memo
cutting Erik, his notebook, the concession stand log, the boiler log, an
overdue library book, the Mad Dog plaque and The Bargain). F to read; they're
kept under Extras → Notes found.

### The intro

`src/render/intro.js`, skippable. *The Cut*, the night before the championship
in the locker room, where the team tells Erik they took a vote; *The Bargain*,
in the boiler room, with Erik in a circle of candles and The Schnitz's eyes in
the steam; and *Tip-off*, a packed gym, where the lights go green, the team's
talent drains up to the Press Box, the court splits open and the shutter slams
down over the booth. It plays the first time you start the map (online, for
everyone; the host can skip it).

### The Final Whistle (the main quest)

Designed by James (`src/sim/quest.js`, `src/render/questView.js`).

1. *Power & the Mad Dog Machine:* throw both breakers, find the three trophy
   pieces (library, locker room, Teachers' Lounge) and rebuild the trophy at
   center court. The stand slides aside and the Mad Dog Machine comes up
   through a trapdoor.
2. *The Schnitz's Coin:* kill zombies near the mascot statue in the Quad. Fed
   enough souls, its eyes ignite and its jaw drops the Dark Schnitz Coin.
3. *Retracting the cladding:* set the coin in the altar under the Press Box;
   the steel cladding grinds up and Erik is there behind the glass.
4. *The half-court sacrifice:* four drained basketballs; hold each glowing
   circle for 45 s while blue spirit zombies claw up out of the court. Each
   restores a talent (Speed, Jump, Power, Defense).
5. *Building the Chopper:* its motor (kitchen), saw blade (auditorium stage),
   housing (art room) and grip (loading dock dumpster) go together on the
   boiler room workbench. Lifting it the first time brings The Schnitz: the
   lights go down, its green eyes open over the stew and it speaks. Then kill
   50 of its infused zombies and upgrade the Chopper in the Mad Dog Machine.
6. *The Intercom Showdown:* call Erik out at the altar. Waves of Zombie
   Defenders while he paints red playbook diagrams on the floor; then elites
   drop Sound Amplifiers for the four speaker towers; then blast the Press Box
   with the upgraded Chopper.
7. *Out of Bounds:* the ending cutscene (`src/render/ending.js`). Erik falls,
   The Schnitz speaks, and past the gym doors the campus is anchored to an
   asteroid in deep space. Brian Luke steps out of a portal: "You guys coming?"

**The Stew song Easter egg:** Erik confiscated the team's three good-luck
charms (the lucky ladle, the warm-up tape, the can of stew). Find all three and
the school plays **"We Go Stew"**, an original pop-punk song generated in code,
with the lyrics as subtitles. It unlocks in the Extras jukebox.

## Map 2: Call of the Crust

Story by Michael Dougherty. Kearns, Ryan, Rocco and Brian follow Erik through
the portal and find five islands floating in space, each on its own meteor
with its own dead, mist and weather. Step off an edge and you're gone. The
Schnitz has the speakers here, the way Erik had the PA. The files are
`src/map/crust*.js`, `src/render/crust*.js`, `src/sim/crustEgg.js` and
`src/sim/crustPower.js`; its numbers are `CONFIG.crust`.

> **Locked for now.** The map select asks for a developer code that only
> Michael and James have (`DEV_CODE` in `src/ui/mapselect.js`); online, the
> host needs it to pick the map, and it's labelled **beta**. The code is
> checked in the browser, so it keeps out casual players, not determined
> ones. It stays until Michael says to release the map.

### The islands

```
                    SHIP GRAVEYARD (Wind)
      a lighthouse on a mesa, a zipline down to a wrecked galleon,
         a capsized hull, wind turbines, a giant head past the cliffs
                               ^
 ICE CAVES (Ice)  <-------  THE ANVIL  ------->  RESEARCH BASE (Lightning)
 a great cavern, ice        an ancient forge:    a radio mast, the observatory,
 shelves, a frozen          a quarry pit with    tesla coils in a storm
 waterfall to the summit    torches and ruins
                               |
                               v
                     TRENCH FRONT (Fire)
      a molten battlefield: keep to the trenches (up top is shelled),
         the fort, the field guns, a crater with a fiend in it
```

- **Getting around:** launch pads fling you between the Anvil's rim and each
  island (F on the pad; 30 s recharge, nothing can touch you in the air).
  Ziplines (F at the top; jump to let go) and ice slides keep your hands free
  to shoot. Dolphin dive off the marked gaps in the guard rails.
- **Power** starts dead. Each of the Anvil's four launchers has blown its
  relay: pull it from the junction box by the pad and carry it to **Pit**, who
  has learned to smith at his bench in the pit. With all four fixed, the
  Anvil's power, launchers and perk machine come on. Every other island has
  its own power switch by its launch pad, and its own perk machine.
- **The Trench Front's guns:** stay up top and shells start landing on you.
  The field telephone in the fort buys a ceasefire (1500).
- **The Schnitz's cage:** Chops, Regs and P hang in an iron cage on a chain
  out over the void past the Anvil's north rim. They shout down when you're
  near. One of you has to go over the edge to get them out.

### The War Hammer (the Easter egg)

1. **The hammer:** its four parts are at the islands' shrines. Bring them to
   the stand at the Anvil and everyone can take a plain iron War Hammer.
2. **The titans:** each island has one guarding its element's core, and none
   of them dies to bullets alone (`src/sim/crustEgg.js`).
   - *The Drowned Captain* (Ship Graveyard, Wind): a giant pirate head that
     spits its drowned crew onto the island in waves and breathes in to pull
     you toward the edge. Outlast every wave.
   - *The Warden* (Research Base, Lightning): a shielded walker. Charge the
     tesla coils at their consoles and lead it past them.
   - *The Glacier Golem* (Ice Caves, Ice): shoot down the icicle clusters as
     it walks under them, then knife the heart when it kneels.
   - *The Molten Fiend* (Trench Front, Fire): man the field guns and lead your
     shots; it lobs magma and erupts.
3. **The forge:** bring each core to Pit. He forges its elemental hammer and
   sets it in its socket on the Anvil (N wind, E lightning, S fire, W ice).
   Take one with your War Hammer in hand and yours takes on that element. Hand
   him an elemental hammer and he tempers it, for a price: a tempered hammer
   leaves a pool of fire, a blizzard, a tornado or a ball of lightning behind
   its swing.
4. **Big Evil Zach:** with all four forged, ring the Anvil and The Schnitz
   brings Zach down into the pit (`src/sim/zachBoss.js`). Only a War Hammer
   gets through, and only the element he's glowing. Land enough hits with
   each of the four and The Schnitz tears itself out of him. His fight plays
   the L4D "Tank" song.

Intro and ending cutscenes frame the map (`src/render/crustFilms.js`), and the
crew, Pit, the boys in the cage, Zach and The Schnitz have about 570 lines
between them (`src/lore/crustCrew.js`).

### New on the Crust

- **Weapons:** the M2 Flamethrower (wonder weapon; Mad Dog: Dragon's Breath)
  and the four elemental War Hammers.
- **Equipment:** **Maisy Dogs** (tactical, Q: she howls, and a black hole opens
  over her that swallows every zombie round it) and **LBDs** (X: a sleeping
  baby set down like a Bouncing Betty that wakes, pops up and goes off when a
  zombie comes near; 1000 for 2).
- Each wall gun appears only once, and the Mystery Box contents differ from
  the school's.

## Perks

Max 4 at once, lost when you go down.

| Perk | Cost | What it does | School | Crust |
|---|---|---|---|---|
| Second Helping | 500 (1500 co-op) | Solo: get back up on your own (3 uses). Co-op: revive twice as fast. Works without power | court | — |
| Beefcake Broth | 2500 | 250 health instead of 100 | cafeteria | Ice Caves (Mine Works) |
| Hot Pot Hustle | 3000 | Reload twice as fast | science lab | — |
| Double Ladle | 2000 | Fire 33% faster, every bullet hits twice as hard | band room | Research Base (Generator Hall) |
| Marathon Minestrone | 2000 | Sprint almost forever, move a little faster | auditorium | Ship Graveyard (Net Shed) |
| PHD Gaylor | 2000 | Your own explosions and falls can't hurt you; a dolphin dive off a ledge lands with a purple blast | the Quad | Trench Front (The Fort) |
| Milton Kick | 4000 | Carry a third weapon (lose it when you go down) | library | the Anvil (Supply Depot) |

The machines are a Juggernog model repainted per perk, with the perk's name
and symbol on the signs. The drink is a glass flask in the perk's colour: pop
the cork and drink it.

**Last stand:** at zero health you drop with a pistol. Solo, you need Second
Helping to get back up; in co-op a teammate holds F on you before you bleed out
(30 s). Picked back up, you get 3 seconds where nothing can hurt you.

## The Mad Dog Machine

Feed it the gun in your hands (5000, needs power) and it comes back upgraded:
double damage, bigger mags, more ammo, a new name and a glowing claw-slash
camo. Upgraded ammo off the wall costs 4500. On the school it rises through a
trapdoor during The Final Whistle.

Every upgraded gun also gets an **alternate ammo** type: **Blast Furnace**
(sets zombies around the hit burning), **Dead Wire** (lightning chains between
them) or **Thunder Wall** (a blast of air throws them back). Feed an upgraded
gun back in for 2500 to get a different one. Numbers: `CONFIG.aat`.

| Weapon | Upgraded name | Damage per bullet (or pellet) |
|---|---|---|
| M1912 | **Twin Stewpots** | 120, dual, explosive rounds |
| M15 | **Detention Hammer** | 264 |
| Olympus | **Wrath of Olympus** | 180 |
| MP41 | **Last Call** | 92 |
| Pyton | **Venom King** | 540 |
| Komando | **Warmonger** | 192 |
| Staykout | **Riot Act** | 215 |
| MP6K | **Hornet's Nest** | 96 |
| MPK | **Buzzsaw Betty** | 92 |
| PM64 | **Pocket Apocalypse** | 76 |
| AK-75u | **Siberian Howl** | 134 |
| M17 | **Triple Threat** | 172 |
| Peacekeeper | **Ceasefire** | 214 |
| CZ76 | **Crimson Viper** | 148 |
| CZ76 Dual Wield | **Viper Twins** | 148 |
| Spectur | **Phantom Shredder** | 110 |
| FAMOS | **Burnout** | 168 |
| AWG | **Grim Overseer** | 196 |
| Galill | **Desert Dirge** | 220 |
| G12 | **Caseless Carnage** | 202 |
| SPAZ-13 | **Bloodbath 13** | 228 |
| HS11 | **Dead Ringers** | 198 |
| HK22 | **Steel Hurricane** | 268 |
| RPKK | **Iron Tsunami** | 230 |
| Dragunoff | **Cold Verdict** | 1260 |
| L96A1 | **Final Exam** | 3960 |
| Desert Eagle | **Sandstorm** | 634 |
| SCAR-H | **Scar Tissue** | 432 |
| M60 | **Death Machine** | 336 |
| China Pond | **Doomsday Dragon** | bigger blast |
| Kross-Bow | **Hellhound's Fang** | bigger blast |
| Ballistik Knife | **Soul Splitter** | 3x knife |
| Fucci Gun | **Fucci Haute Couture** | pink plasma, 40-round mag, bigger splash |
| Fucci Gun Mk 2 | **Fucci Runway Edition** | |
| Scavenger | **Carrion Crown** | |
| The Chopper | **The Meat Grinder** | 17 m, a wider cone, four shots a clip |
| M2 Flamethrower | **Dragon's Breath** | |

The numbers come from `CONFIG.weapons` in `src/config.js`; if they drift, the
config is right.

### Wonder weapons and the box

- **The Fucci Gun:** a designer energy pistol in black lacquer and gold. Gold
  plasma rings hit for 1000 and splash everything around the impact. The
  **Fucci Gun Mk 2** fires a laser.
- **The Chopper** (`src/sim/wind.js`): each shot is a wall of wind that kills
  every zombie in a cone and throws it end over end. Two shots a clip.
- **Stew Bombs** (Q, 3 at a time): a pot of stew with a ladle banging out a
  tune. Every zombie nearby crowds round it for 7 seconds, then it blows.
- **The M2 Flamethrower** and the **Scavenger** are box wonder weapons too.

## Power-ups and Cheddar Rounds

Power-ups drop from zombies you kill inside the map (up to 4 a round, more
likely as your points add up). Walk over one to grab it; they blink and vanish
after 30 seconds.

| Power-up | What it does |
|---|---|
| Full Pantry | all ammo and grenades refilled, for everyone |
| One Bite | everything dies in one hit for 30 s |
| Double Dough | double points for 30 s |
| Pressure Cooker | every zombie on the map dies, +400 points |
| Shop Class | every barrier rebuilt, +200 points |
| Clearance Sale | a Mystery Box at every box spot, all at 10 points, for 30 s (with a cheesy game-show tune) |

**Cheddar Rounds:** the first lands on round 5, 6 or 7, then every 4–6 rounds.
A yellow haze rolls in, thunder rumbles, and Erik's rabid hounds (Cheddars)
come down with lightning strikes instead of zombies. They're fast and bite
hard, and every few seconds the nearest one asks if you wanna play 2K. The last
one killed leaves a Full Pantry.

## GobbleGum

All 64 Black Ops 3 gums (`src/sim/gums.js`, numbers in `CONFIG.gobblegum`).

- **Your pack:** pick 5 gums on the GobbleGum blade. Your pack is saved to your
  username.
- **The machines** stand next to the perk machines. A pull costs 500, then
  1000, then 2000 points (3 a round), and hands you one of your 5 at random.
  A machine goes dark for a while after a few uses. They're real gumball
  machines, and every gum has a canvas-drawn BO3-style logo
  (`src/render/gumIcons.js`) in the menu, on your HUD and over the machine.
- **Using them:** some gums go off on their own, some last a while or a few
  rounds, and activated ones go off when you press **H** (D-pad ↓).
  **Classic** gums never run out; **Mega**, **Rare Mega** and **Ultra-Rare
  Mega** gums are used up as they come out of the machine. Works online.
- **Liquid Divinium:** vials earned by playing (the longer you last, the
  more), saved to your username. A new career starts with 3.
- **Dr. Monty's Factory** (`src/ui/factoryUI.js`): three vats and three
  buttons. Button 1 costs 1 vial for 2 Megas, button 2 costs 2 for 4, and
  button 3 costs 3 for 7. The vats bubble, their copper doors open, and your
  gums are inside.

## Careers and achievements

When the game starts it asks **who's playing**. Pick a username and make a
4-digit PIN the first time; from then on only you can sign in as that name.
**Play as a guest** saves nothing. Settings → Switch username changes it.

- **Stats:** kills, revives, rounds survived, headshots, downs, games played
  and your best round, under Extras → Career & Achievements.
- **Achievements:** ten to start, 500G in all, Xbox-style, with a pop-up the
  moment you earn one (`src/career/achievements.js`).
- **How it's saved** (`src/career/`): in the browser always, and online in a
  Firebase Realtime Database (`stew-zombies-default-rtdb`) over plain REST,
  with no SDK. Counters go up as increments, so two games on two computers
  under the same name both count; if the database can't be reached they wait
  in the browser. The database rules only let a career's own sign-in write to
  it. The web API key in `config.js` is public by design.

## Play online

**Play Online** on the Play blade. One of you picks **Host a game** and gets a
four-letter room code (and a **Copy invite link** button). Everyone else types
the code and presses **Join**, or opens the invite link. In the lobby each of
you claims a character, and the host picks the map and presses **Start the
game**. Up to four players.

- It runs browser to browser (WebRTC through PeerJS, loaded only when you go
  online). PeerJS's free public server just introduces the browsers; there's
  no game server to run.
- The host's browser runs the real game. Everyone else's browser moves and
  shoots their own player right away and tells the host what they hit; the
  host runs the zombies, buying, perks, gums, points and the bosses, and sends
  everyone what changed about 30 times a second.
- You see your teammates as their character holding their gun, with their name
  over their head (red when they're down).
- Go down and a teammate can hold **F** on you. Bleed out and you're back at
  the start of the next round with the starting pistol; until then you
  spectate a teammate over their shoulder (click or RT / R2 to switch).
- The intro plays for everyone; the host can skip it or switch it off in the
  lobby. The pause menu doesn't pause an online game. If the host leaves, the
  game ends.
- On one computer, `?net=local` in the address lets two tabs of the same
  browser play together (for testing).

### Putting it online (GitHub Pages)

The game is static files, so GitHub Pages hosts it for free from `master`
(Settings → Pages → Deploy from a branch, **master**, **/ (root)**). Each update
goes live after a push to `master` (**Push origin** in GitHub Desktop).

## Firing Range and Explore

**Firing Range** (Play blade): try every weapon without rounds in the JROTC
range under the school. Target dummies stand at 5 to 50 m and get back up a
moment after they die, and you can't die. Press **B** for the weapons &
options panel: take any weapon (or its Mad Dog version), set the dummies to any
round's health, infinite ammo, moving targets, send a horde, toggle perks,
drop power-ups, send Cheddars, and take Stew Bombs, Maisy Dogs or LBDs. The
readout shows the gun's stats, damage per second, time to kill and accuracy,
and damage numbers float off every hit. The Mystery Box and a frag wall buy
are in the armory, with 50,000 points to spend.

**Explore** (Play blade): the map with endless points; buying is free and you
can't die. **B** (View) opens the Explore menu (`src/ui/explore.js`): spawn any
gun (plain or Mad Dog'd), start any round, switch the zombies on or off, and
jump to any part of the Easter egg.

## The crew talks

Kearns, Ryan, Pit and Rocco carry walkie-talkies. Whoever you play talks out
loud; the others answer on the radio (crackle, chirps, a tinny voice). They
hold conversations at story moments, react while you play (going down,
revives, kills, box pulls, perks, dry fire) and banter between rounds. Lines
live in `src/lore/crew.js` (the school) and `src/lore/crustCrew.js` (the
Crust); the director is `src/sim/crew.js`.

**Voices:** Erik (all 115 lines), Kearns, Ryan and Rocco are recorded; anyone
unrecorded falls back to synthesized babble timed to each line. To add a
character's recordings, run `python3 tools/voice/import.py <their zip or
folder>` (or `--as <speaker>` if the files came back numbered). It trims and
levels the mp3s (named as in `tools/voice/script.csv`), keeps them in
`tools/voice/clips/<speaker>/`, packs each speaker into one sprite
`assets/voice/<speaker>.mp3` and regenerates `src/lore/voiceLines.js`.

## Look, sound and performance

- **The look,** aimed at the 2010 Treyarch zombies feel: a split-tone grade,
  a filmic curve, fine grain, ambient occlusion, photo-scanned surfaces
  (ambientCG, CC0; `src/render/surfaces.js`, built by `tools/make_textures.py`),
  baked light and soft shadows (`src/render/bake.js`), wet floors and
  reflections (`src/render/puddles.js`), muzzle smoke, blood that pools and
  streaks, and dust in the light beams.
- **Graphics settings:** a quality preset (Low, Medium, High, Ultra), auto
  resolution that drops when the frame rate dips, a frame-rate cap, render
  scale down to 35%, an effects level, and simple zombie and gun models. The
  numbers behind each level are in `CONFIG.graphics`; `src/render/quality.js`
  applies them.
- **Performance:** far-off details are culled (`graphics.farCull`), still
  scenery is merged into a few big meshes (`mergeStatic`), and characters draw
  once per material (`rigidSkin`).
- **Gun sounds:** recordings of real firearms from *The Free Firearm Sound
  Library* (Still North Media, CC0), packed into one file
  (`assets/sfx/guns_pack.mp3`, built by `tools/pack-sounds.mjs` from
  `sfx-src/guns/`) and mapped per weapon in `src/audio/gunSamples.js`.
- **The trailer** (Extras): a scripted camera run through the real Crust
  (`src/render/trailer.js`, timings in `CONFIG.trailer`).

### Models

- **Zombies:** eight Mixamo characters with Mixamo zombie animations,
  converted by `tools/zombies/` into `assets/zombies/` (loaded in the
  background; the older procedural zombies stand in until they arrive). Limbs
  come off, and five deaths are picked by where the shot came from.
- **Guns:** most guns use downloaded Sketchfab models (credits in Extras),
  shrunk by `tools/guns/convert_gun.py` into `assets/guns/`. Every gun is
  still built in code first: that version decides where the hands, muzzle and
  sights go. `REAL_GUNS` in `src/render/gunModels.js` says which file each gun
  uses and where its grip is.
- **Hands:** a sculpted, rigged hand (`tools/hands/build_hand.py`,
  `src/render/handModel.js`) posed on each gun like a real shooter's grip
  (`FP_HANDS` in `gunModels.js`).
- **The crew:** every member of Stew and Erik are built in code from one data
  table (`CHARACTERS` in `src/render/characters.js`), with rigged hands
  (`src/render/hands.js`) and layered idle animation and signature gestures
  (`src/render/characterAnim.js`).
- **Props:** `tools/props/build_props.py` shrinks the downloaded props
  (perk machines, the Mad Dog Machine, the jukebox, trophy, Mystery Box,
  gumball machine) into `assets/props/`; `src/render/propModels.js` turns them
  into the game's versions. Each stands in for a built-in version you'd see if
  it can't load.
- **The Cheddars:** a skinless beast model rigged by
  `tools/cheddar/build_hound.py` into `assets/cheddar/`.
- **The Crust:** its downloaded models are in `assets/crust/`
  (`tools/crust/`), loaded by `src/render/crustModels.js`.

## Patch notes

The first time the game opens after an update, a "What's new" pop-up lists the
changes, with a thank-you note and photo from Michael and James at the top
(`src/ui/patchNotes.js`). It shows once per update on each browser, and Extras
→ Patch notes brings it back. For the next update, add to `PATCH` in plain,
non-technical language and change its `version`.

## Tweaking balance and feel

Every number that affects feel or balance is in **`src/config.js`**: prices,
box odds, movement, recoil, zombie speeds and health, round sizes, points,
weapon stats, perks, gums, the Crust's titans and boss, graphics and audio.
Change a value, refresh.

## Code layout

```
index.html            page, HUD and menu markup, styles, import map
src/config.js         all tunable numbers
src/main.js           wires everything together; fixed-step game loop

src/sim/              GAME LOGIC — no three.js, no DOM, no audio
  sim.js              GameSim: state, step(dt), events, hitscan, snapshot()
  player.js           movement, sprint, dolphin dive, prone, health, interaction
  weapons.js          firing, spread, recoil, reloads, ADS, dual wield, grenades, knife
  projectiles.js      thrown/fired projectiles, explosions
  gadgets.js          Maisy Dogs, LBDs, what a tempered War Hammer leaves behind
  zombies.js          spawning, windows, climbing, chasing, attacks, damage
  rounds.js           round counts, spawn pacing, intermissions
  perks.js            perk effects, buying (and drinking), losing them
  gums.js             GobbleGum machines and every gum's effect
  laststand.js        going down, self-revive, bleed out, revive
  powerups.js         drops, pickups and timed power-up effects
  pa.js               Erik (and The Schnitz) on the speakers, the intercom
  crew.js             the crew's walkie-talkie chatter
  quest.js            The Final Whistle (Stew Leonard High's quest)
  crustEgg.js         the Crust's titans; crustPower.js its power; forge.js Pit's forge;
                      hammers.js the War Hammers; zachBoss.js Big Evil Zach
  launchers.js        launch pads; rides.js ziplines and ice slides; shelling.js the Trench guns
  range.js            Firing Range mode
  physics.js          character vs box collision, steps, gravity
  nav.js              region/portal pathing between rooms (closed doors block)
  interactables/      windows, doors & debris, wall buys, box, machines, lore notes

src/career/           careers: stats, achievements, PINs (Firebase over REST)
src/lore/             every line of story text (erik.js, crew.js, crustCrew.js) and voice timing
src/map/              map data: school.js, crust.js (+ islandKit.js, terrain.js), range.js; builder
src/render/           three.js views: map, zombies, viewmodel, camera, effects, characters,
                      cutscenes (intro.js, ending.js, crustFilms.js), the Crust (crust*.js),
                      gumIcons.js, quality.js, trailer.js
src/audio/            Web Audio engine, synthesized sounds, event → sound director, music
src/input/            keyboard/mouse/controller → per-tick input commands; button prompts
src/ui/               HUD, the title's blades and menus, map select, career, GobbleGum and
                      the Factory, settings, Firing Range panel, controller menu navigation
src/net/              online co-op: state diffs (state.js), host.js, client.js, the lobby
                      (online.js), PeerJS / same-browser connections (peer.js)
tests/                headless tests: node tests/<name>_headless.mjs
tools/                asset pipelines (models, textures, voices, sound pack) and the artifact build
```

The simulation only takes **input commands** and produces **state + events**.
Rendering, audio and the HUD just read those. That separation is what let
online co-op drop in.

In the browser console, `STEW.sim` is the live game state and
`STEW.debug.run(seconds)` fast-forwards the simulation.

## Tests

There are 42 headless tests; run each with `node tests/<name>_headless.mjs`
before pushing. `tests/syntax_headless.mjs` catches a file that won't parse
(which stops the whole game loading). If a change touches `sim.rng`, run the
Crust and school tests too, because new random draws shift everything after
them.

## History

1. ✅ Movement, camera, controls, M1912, knife, zombies, rounds, points, windows (basketball court)
2. ✅ Main hallway, cafeteria, front office, doors, first wall weapons, mystery box
3. ✅ Full weapon list, recoil/reload/sound per gun, grenades
4. ✅ Rest of the map, second path, boiler room, auditorium, the Quad, electric traps, power
5. ✅ Perk machines, Mad Dog Machine, last stand and revive
6. ✅ Power-ups and Cheddar Rounds
7. ✅ Fucci Gun, The Chopper, Stew Bomb, box movement
8. ✅ Erik's PA and intercom, the Stew song Easter egg, the story, menus, polish
9. ✅ Online co-op for 2–4 players
10. ✅ The overhaul: new look, real guns and hands, the crew, the intro and The Final Whistle
11. ✅ **2.0:** Call of the Crust, careers, GobbleGum, alternate ammo, the new main menu
