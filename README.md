# Stew Zombies

An original round-based zombies game for the browser. Everything you see and
hear (models, textures, sounds) is generated in code. The only library is
[three.js](https://threejs.org) (r160), loaded from a CDN.

**Current: the overhaul (between Phases 8 and 9).**

- **New look, aimed at the 2010 Treyarch zombies feel:** cool shadows and warm
  light (split-tone grade), a filmic S-curve, light sharpening and edge
  fringe, fine grain, colder fog, screen-space ambient occlusion (toggle in
  Settings), surface relief on walls, floors and wood.
- **Zombies rebuilt:** sculpted heads (sunken cheeks, glowing eyes, hinged
  jaws with teeth), real hands, and nine torn-up outfits (reunion suits,
  letterman jacket, flannel, janitor overalls, lunch lady...). See
  `src/render/zombieKit.js` and `src/render/human.js`.
- **Guns rebuilt:** rounded machined edges, walnut grain, worn steel, and
  Kearns' bare forearms and hands (with a wristwatch) instead of block gloves.
- **Real gun sounds:** recordings of 17 real firearms plus reloads, bolts and
  pumps from *The Free Firearm Sound Library* (Still North Media, CC0), cut
  into `assets/sfx/guns/` and mapped per weapon in `src/audio/gunSamples.js`.
- **Photo surfaces:** real photo-scanned materials (ambientCG, CC0) on the
  school: painted cinder block, red brick, glazed tile, speckled vinyl tile,
  maple gym floor, stage planks, carpet, concrete, ceiling tiles, grass. The
  painted textures still set the colours, stripes, stains and grime; a shader
  (`src/render/surfaces.js`) multiplies in the photo's detail at real-world
  scale and lights it with the photo's normal map. Images live in
  `assets/tex/`, built by `tools/make_textures.py`.
- **Baked lighting:** when a map loads, the light from every fixture, lamp
  and the moon is worked out for the floors, walls and ceilings
  (`src/render/bake.js`), with soft shadows (light no longer shines through
  walls; tables, lockers and bleachers cast soft shadows) and darkened
  corners. The two lights that matter most at each spot follow their live
  brightness, so tubes still flicker and the power still comes on in a wave;
  muzzle flashes, explosions and the mystery box are added on top live. It
  appears straight away unshadowed and the shadows fill in over a second or
  two, a few milliseconds a frame.
- **Effects:** muzzle smoke that builds into wisps curling off a hot barrel;
  blood that pools under the dead, drips from the badly hurt and streaks
  along walls the way it flew; dust shaken from the ceiling by explosions;
  dust motes in the beam of every light that's on; wet floors, with puddles
  (some under a dripping leak that rings the water) and blood pools that
  mirror the room (`src/render/puddles.js`; Settings → Reflections).
- **Explore mode** (main menu): the school with endless points; buying is
  free, you can't die, and **Z** switches the zombies on and off.
- **ADS fixed:** aim, recoil and scope sway are interpolated between 60 Hz
  ticks, gun sway follows smoothed mouse speed, aim sensitivity blends
  smoothly, and the camera no longer rolls while aiming.
- **The crew:** every member of Stew (Kearns, Ryan, Rocco, Pit, Chops, Brian,
  Regs, Zach, P) and Erik Madsen as stylized models built in code from one
  data table (`CHARACTERS` in `src/render/characters.js`): body proportions
  and height, sculpted face, hairstyle, outfit layers (open jackets, suits,
  prints) and accessories (chains, watches, bracelets, earrings), each with
  an idle (P throws his sideways peace sign, Rocco bounces, Erik rubs his
  hands together). Main menu → Characters → *See the whole crew* opens the
  lineup: drag to turn them, pick a name to fly over, Face to zoom in.
- **Recoil:** every shot punches the camera (it springs straight back, so
  your aim isn't moved by it), kicks the gun back in your hands, and climbs
  your aim while you hold the trigger; let go and it settles. Tunable in
  `CONFIG.recoil`.
- **Characters:** a character select screen (main menu → Characters) with
  the model on a turntable under a spotlight (drag to spin). Playable at
  launch: **Kearns**, **Ryan**, **Pit** and **Rocco** (Kearns keeps his four
  T-shirt colours). **Brian** unlocks once you finish The Final Whistle. Your
  first-person arms take your character's skin and sleeves. Built in
  `src/render/characters.js`.
- **The crew talks:** the four carry walkie-talkies. Whoever you play talks
  out loud; the others answer on the radio (crackle, chirps, a tinny voice),
  and Erik cuts in on the PA. They hold conversations at story moments (the
  radio check and Pit showing up after his suspension, the power, the trophy
  and his diss track, Ryan finding his machine was taken for the gun upgrades,
  the ritual, the boss), react while you play (going down, revives, kills, box
  pulls, perks, dry fire), banter between rounds (Kearns' iPad mini, Rocco's
  2K, Maisy dog, Kearnita), and Erik roasts whoever you're playing. Lines live
  in `src/lore/crew.js`; the director is `src/sim/crew.js`.
- **Hands, faces, animation:** the crew's hands are rigged (`src/render/hands.js`):
  a palm with thumb and pinky pads, three-bone fingers with knuckles and nails,
  and a thumb, posed as relaxed, open, fist, point, peace, thumbs up, finger
  guns... Faces got bigger, glossier eyes (iris fibres, limbal ring, catchlight,
  clearcoat), a rounder nose with nostrils, smile lines, a lip highlight, and a
  skin roughness map (shiny T-zone, matte beard and brows) with pore relief.
  Animation (`src/render/characterAnim.js`) layers breathing, weight shifting,
  blinking and glancing over each idle, and every character has a signature
  gesture placed with two-bone IK: Kearns strokes his beard, Ryan punches his
  palm, Chops and Regs give a thumbs up, Brian waves, Zach claps, Pit scratches
  his head, Rocco dances with finger guns, Erik drums his fingers.

Phase 8 (built): Erik's on the PA.


- **The story** (rewritten for *Out of Bounds*, story by James Amarante): the
  undefeated Stew Leonards cut Erik Madsen (#8) right before the championship.
  He sold his soul to The Schnitz, and at tip-off he stripped the team of
  their talent and raised the dead on Stew Leonard High. He's sealed in the
  metal-clad Press Box over center court. All of the story text lives in
  `src/lore/erik.js`.
- **Erik on the PA:** he reacts to the game (the intro, milestone rounds,
  Cheddar Rounds, the power, the box moving, you going down, multi-kills, game
  over) and throws in the odd barb when it's quiet. Each line starts with the
  school chime, plays as a placeholder voice through the PA speakers in every
  room (their red light flickers while he talks) and shows as a subtitle.
- **The intercom:** press F at the PA handset in the teachers' lounge to talk
  back. Eight scripted exchanges, then he just tells you to stop pressing the
  button.
- **Notes:** eight notes around the school (the championship program, the
  coach's memo cutting Erik, his notebook, the concession stand log, the boiler
  log, an overdue library book, the Mad Dog plaque and The Bargain itself). F to
  read; they're remembered under Extras → Notes found.
- **The Final Whistle** (the main quest, designed by James; `src/sim/quest.js`,
  `src/render/questView.js`), with its objective in the top-left corner:
  1. *Power & the Mad Dog Machine:* throw the main breakers in the cafeteria and
     the science lab (they replace the old power switch), find the three trophy
     pieces (library, locker room, teachers' lounge) and rebuild the trophy at
     center court. The stand slides aside and the Mad Dog Machine comes up
     through a trapdoor.
  2. *The Schnitz's Coin:* kill zombies near the towering mascot statue in the
     Quad. Fed enough souls, its eyes ignite and its jaw drops the Dark Schnitz
     Coin.
  3. *Retracting the cladding:* set the coin in the altar under the Press Box;
     the steel cladding grinds up and Erik is there behind the glass.
  4. *The half-court sacrifice:* four drained basketballs; hold each glowing
     circle for 45 s while sprinters claw up out of the court. Each restores a
     talent (Speed, Jump, Power, Defense); solo you get all four.
  5. *The Intercom Showdown:* call Erik out at the altar. Waves of Zombie
     Defenders in Stew Leonards jerseys while he paints red playbook diagrams
     on the floor; then elites drop Sound Amplifiers for the four speaker
     towers; then shoot the main soundboard wire.
  6. *Out of Bounds:* the ending cutscene (skippable): the glass shatters, Erik
     falls, The Schnitz speaks, Erik vanishes, and past the gym doors the
     campus is anchored to an asteroid in deep space. Brian Luke steps out of
     a portal: "You guys coming?" Title card for Map 2 (`src/render/ending.js`).
- **The intro** (`src/render/intro.js`, skippable): *The Cut*, the night
  before the championship in the locker room, where the team (in their
  green-and-gold jerseys) tells Erik, #8, they took a vote; *The Bargain*,
  later that night in the boiler room, with Erik in a circle of candles and
  The Schnitz's eyes in the steam ("Talent has a price, Number Eight"); and
  *Tip-off*, a packed gym, where Erik on the PA welcomes the undefeated Stew
  Leonards ("...Not anymore"), the lights go green, the team's talent drains
  up to the Press Box, the balls go dead, the court splits open, and the
  shutter slams down over the booth. (The court only gets its blood once the
  dead are out.) It plays the first time you start the
  map; the map screen and Extras can play it again.
- **Set dressing:** the Press Box hanging over a blood-streaked court,
  fiberglass dairy cows, a rotting animatronic cow band on the cafeteria stage,
  the store-style cafeteria marquee and the Rule #1 rock in the Quad
  (`src/render/storyProps.js`).
- **Easter egg:** Erik confiscated the team's three good-luck charms (the
  lucky ladle, the warm-up tape, the can of stew). Find all
  three and the school plays **"We Go Stew"**, an original pop-punk song
  generated in code (drums, two guitars, bass, gang vocals) with the lyrics as
  subtitles. It unlocks in the Extras jukebox.
- **Menus:** Extras (story, notes, how to play, jukebox, credits), title music,
  Erik's last word on the game-over screen, voice volume and subtitle settings.
- **Polish:** posters, banners and graffiti painted in code all over the
  school, a red damage-direction indicator, and a hit tick sound.
- **Voices:** Erik and Kearns are recorded (`assets/voice/<speaker>/`). Everyone else is
  still synthesized babble timed to each line. To add a character's recordings,
  run `python3 tools/voice/import.py <their zip or folder>`: it trims and
  levels the mp3s (named as in `tools/voice/script.csv`, the line list sent
  out for TTS), copies them into `assets/voice/<speaker>/` and regenerates
  `src/lore/voiceLines.js`. Recorded lines play automatically (PA, walkie or
  in person) and the game times subtitles and turn-taking to their length;
  anything unrecorded falls back to the synth.

Phase 7 (built):

- **The Fucci Gun** (Mystery Box): a designer energy pistol in black lacquer
  and gold. Gold plasma rings hit for 1000 and splash everything around the
  impact. Mad Dog upgrade: **Fucci Haute Couture** (pink plasma, 40-round mag,
  double damage, bigger splash).
- **The Chopper** (Mystery Box wonder weapon, `src/sim/wind.js`): each shot is
  a wall of wind. Every zombie in a wide cone out to 13 m (and anything right
  up against you) is killed and thrown, end over end, as far as the walls let
  it fly. Two shots a clip, a sub-bass punch and a howling roar, shock rings
  down the cone and the dust coming off the floor. Mad Dog upgrade: **The Meat
  Grinder** (17 m, a wider cone, four shots a clip).
- **Stew Bombs** (Mystery Box, press **Q**, 3 at a time): a pot of stew with a
  ladle banging out a tune. Every zombie within ~30 m drops what it's doing
  and crowds round it for 7 seconds, then it blows.
- **The box moves:** after 5–9 pulls in one spot it lands on Erik's
  bobblehead instead. You get your points back, it laughs at you, and the box
  flies off to one of five spots: the main hallway, **the Quad**, the loading
  dock, the library or the auditorium. Follow the blue light.

Phase 6 (built):

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
| Q | Stew Bomb (from the Mystery Box) |
| V or E | Knife (lunges at nearby zombies) |
| F | Buy doors, debris, wall weapons and the Mystery Box |
| F (hold) | Rebuild a window barrier, one plank at a time |
| 1 · 2 · mouse wheel | Switch between your two weapons |
| Tab (hold) | Scoreboard: points, kills, headshots, downs and revives for everyone |
| Esc | Pause / settings (sensitivity, aiming sensitivity, FOV, volume…) |

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
| A · B | ✕ · ○ | Jump · crouch (toggle) |
| X | □ | Buy / use (hold to rebuild or revive); reload when there's nothing to buy |
| Y | △ | Switch weapons |
| RB · LB | R1 · L1 | Frag grenade (hold to cook) · Stew Bomb |
| Menu | Options | Pause |
| View (hold) | Create (hold) | Zombies: scoreboard · Firing Range: weapons panel · Explore: zombies on/off |

Menus: D-pad or left stick to move, A/✕ to select, B/○ to go back, D-pad
left/right for sliders, LB/RB (L1/R1) to flip tabs, shirt colours or lineup
characters, right stick to turn characters or scroll. Settings has controller
look speed, aim assist and vibration.

## Zombies (models and animations)

The zombies are eight Mixamo characters with Mixamo zombie animations,
converted for the browser by `tools/zombies/` into `assets/zombies/` (about
10 MB, loaded in the background on the title screen; until they arrive the
older procedural zombies stand in).

- Characters: the bloody walker, the cop, Zombiegirl, Yaku, and four ordinary
  people (Remy and three Mixamo regulars) zombified for the game: grey-green
  dead skin, bruises and veins, dirty clothes, blood, sunken eyes and a
  bloody mouth. Every zombie's eyes glow green.
- Animations: two walks (each zombie keeps one), run, sprint and crawl
  (played at the speed the zombie is actually moving), idle, attacking,
  reaching through the window boards (some punch at them instead), two hit
  flinches (upper body only), and five deaths picked by where the shot came
  from (shot in the face, they go over backwards; from behind, they pitch
  forwards; explosions throw them).
- Limbs still come off: arms at the elbow, heads, and legs (the zombie keeps
  coming on its hands).

## Guns (models)

Most guns use downloaded Sketchfab models (credits in Extras), shrunk by
`tools/guns/convert_gun.py` into `assets/guns/` (about 30 MB in all, each
loaded the first time that gun is shown). Every gun is still built in code
first: that version decides where the hands, muzzle and sights go and is what
you see until the model arrives. `REAL_GUNS` in `src/render/gunModels.js`
says which file each gun uses, which way it has to be turned, and which parts
of the download to leave out (spare magazines, loose rounds). The PM64,
Galill and G12 have no model yet.

**Hands on the guns.** The first-person hands are a sculpted, rigged hand
(`tools/hands/build_hand.py` re-rigs it into `assets/hands/`;
`src/render/handModel.js` poses it). Each joint bends about its own hinge
the way real knuckles do. The grips in `FP_HANDS` (`gunModels.js`, the `real`
entries) are posed like a real shooter: the back strap in the web of the
hand, three fingers round the front strap onto the far panel, the index pad
on the trigger, the thumb forward along the left side; the support hand cups
the other one on a pistol, clamps the handguard from below on a long gun, or
wraps a vertical foregrip (MP6K, Spectur, AWG). A real gun's grip isn't where
the built-in gun's was, so `REAL_GUNS` also says where it is: `rh` / `rk`
(shooting hand offset and grip rake) and `lh` / `lk` / `lr` (support hand).
When aiming, a gun is pushed out until the shooting hand is at least 19 cm in
front of your eye.

## Map select

**Play** opens a star chart (`src/ui/mapselect.js`). Since the end of The
Final Whistle the campus sits on an asteroid in deep space, so each map is its
own world: Stew Leonard High on its rock (the school drawn to scale from the
real level, with its rooms named when you zoom in close, and Brian's portal
just off the edge), and planets for the maps that aren't out yet: a ringed
giant for Map 2 at the end of a dotted route from the portal, an ice world and
a red one, each "coming soon" with a hint. Drag it, scroll or pinch to zoom;
the stars and nebulae drift behind. The list on the left (or the pins) picks a
map. "Play the intro first" is ticked until you've seen it. On a controller
the bumpers switch maps.

## Patch notes

The first time the game opens after an update, a "What's new" pop-up lists
the changes, with a thank-you note and photo from Michael and James at the
top (`src/ui/patchNotes.js`; the photo is `assets/ui/thanks.jpg`). It shows
once per update on each browser, and Extras → Patch notes brings it back.
For the next update, edit `PATCH` and change its `version`.

## Props (models)

`tools/props/build_props.py` shrinks the downloaded props into
`assets/props/` (`tools/props/blend.py` reads the trophy's .blend file).
`src/render/propModels.js` turns them into the game's versions at load time:

- **Perk machines:** one Juggernog machine, repainted per perk: its red is
  swapped for the perk's color, and the signs are redrawn with the perk's
  name and symbol (they glow when the power's on).
- **Perk drinks:** a glass flask with the drink inside in the perk's color and
  a label with its name and symbol. It spins in the machine's window, and
  it's what you drink (the cork pops off first).
- **Mad Dog Machine:** a Pack-a-Punch machine in dark gunmetal and blood red,
  with a "MAD DOG" sign and a dog's head on the badge.
- **Jukebox, trophy, Mystery Box:** the jukebox in the teachers' lounge, the
  championship trophy (and the three pieces of it the quest scatters), and
  the Mystery Box, whose lid swings open on a hinge.

Each one stands in for a built-in version, which you'd see if it can't load.

## The Cheddars (hounds)

The hounds are a skinless beast model, recolored cheddar yellow, thinned out
and rigged by `tools/cheddar/build_hound.py` into `assets/cheddar/` (about
1.4 MB). The rig (body, neck, head, jaw, four legs, a four-bone tail) is
driven in code: a gallop matched to their speed, a lunge and a snapping jaw.
Every few seconds the nearest one asks you if you wanna play 2K.

## Clearance Sale, the cauldron, and getting back up

- **Clearance Sale** (the fire sale): while it lasts a Mystery Box drops in
  at every box spot, all at 10 points, and a cheesy game-show tune plays. When
  it ends they finish any pull in progress and vanish.
- **The jukebox** in the Teachers' Lounge, next to Erik's PA microphone:
  press F for "We Go Stewie", again for "That's That Marmaduke", again to
  stop (`assets/music/`). Everyone online hears the same song from it.
- **The half-court ritual**: the circles are twice as big (3.2 m). While one
  is lit, ordinary zombies leave whoever's in it alone; blue spirit zombies
  with blazing blue eyes claw up out of the court instead, and when they die
  they float up into the air and fade away.
- **The boiler room cauldron**: a vat of stew bubbling over a fire, fed by
  pipes from the boiler. Shoot the three red valves open (one on the feed
  pipe, one on the pipe bank, one up in the corner by the door) and it boils
  over: 1000 points for everyone and a Double Dough.
- Picked back up by a teammate (or Second Helping): 3 seconds where nothing
  can hurt you (`lastStand.reviveInvuln`).
- One hit from going down, the edges of the screen throb red.
- If the browser is still holding the sound back (after a refresh, or if you
  only touched a controller), a note at the top says to click or press a key.

## Play online

**Play Online** on the title screen. One of you picks **Host a game** and
gets a four-letter room code (and a **Copy invite link** button). Everyone
else types the code and presses **Join**, or just opens the invite link. In
the lobby each of you claims a character (Kearns, Ryan, Pit or Rocco, and
Brian if you've finished The Final Whistle in that browser; finish it in an
online game and he's pickable as soon as you're back in the lobby), and the
host presses **Start the game**. Up to four players.

- It runs browser to browser (WebRTC through PeerJS, loaded only when you go
  online). PeerJS's free public server just introduces the browsers; the game
  goes straight between them. There's no game server to run.
- The host's browser runs the real game. Everyone else's browser moves and
  shoots their own player right away (so controls feel local) and tells the
  host what they hit; the host runs the zombies, buying, perks, points and
  Erik, and sends everyone what changed about 30 times a second.
- You see your teammates as their character holding their gun, with their name
  over their head (red when they're down) and their points over yours.
- Go down and a teammate can hold **F** on you to pick you up. Bleed out and
  you're back at the start of the next round, with the starting pistol.
  Until then you watch a teammate who's still up, over their shoulder; click
  (or RT / R2) to switch to the next one.
- Hold **Tab** (or **View / Create** on a controller) for the scoreboard.
- The pause menu doesn't pause an online game. Game over or the ending takes
  everyone back to the lobby when the host says so. If the host leaves, the
  game ends.
- The game needs to be on a real web address for friends to reach it (see
  *Putting it online* below). On one computer, `?net=local` in the address
  lets two tabs of the same browser play together (for testing).

### Putting it online (GitHub Pages)

The game is static files, so GitHub Pages can host it for free:

1. In GitHub Desktop: **File → Add Local Repository…**, pick this folder.
2. **Publish repository**, untick *Keep this code private* (free Pages sites
   need a public repository), and publish.
3. On github.com, open the repository → **Settings → Pages**. Under *Build and
   deployment* pick **Deploy from a branch**, branch **master**, folder
   **/ (root)**, and **Save**.
4. A minute later it's live at `https://<your-username>.github.io/stew-zombies/`.

After that, each update is **Push origin** in GitHub Desktop.

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
- Drop any power-up in front of you, send a pack of Cheddars, or take Stew Bombs.

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
  pa.js               Erik on the PA: when he talks, what he says, the intercom
  physics.js          character vs box collision, steps, gravity
  nav.js              region/portal pathing between rooms (closed doors block)
  interactables/      windows, doors & debris, wall weapons, mystery box,
                      power switch, perk machines, Mad Dog Machine, traps, revive,
                      intercom, lore notes, Stew items (lore.js)

src/lore/erik.js      every line of story text: PA lines, intercom, notes, lyrics
src/map/              map data (school.js, range.js: rooms, windows, doors, props, nav) + builder
src/render/           three.js views: map, zombies (zombieKit.js), viewmodel, camera, effects,
                      gunModels.js (guns, first-person grips), handModel.js (the sculpted hand),
                      propModels.js (perk machines, drinks, Mad Dog, jukebox, trophy, box),
                      gltfLite.js (loads the downloaded models),
                      post, characters (human.js sculpts heads/bodies; showcase.js = select screen)
                      bake.js (baked light and shadows), puddles.js (wet floors, reflections)
src/audio/            Web Audio engine, synthesized sounds, event → sound director,
                      music.js (title theme and the Stew song sequencer)
src/input/            keyboard/mouse/controller → per-tick input commands
  gamepad.js          controller polling, Xbox/PlayStation detection, dead zones, rumble
  glyphs.js           button prompts for keyboard, Xbox and PlayStation
src/ui/               HUD (tally marks, points, ammo, subtitles, notes), menus, extras,
                      settings, firing range panel, controller menu navigation (menunav.js)
src/net/              online co-op
  state.js            what the host sends (worldState), patches (diff/applyPatch),
                      and how a friend's copy takes it in (applyMirror)
  host.js             NetHost: applies friends' reports (moves, hits, throws), sends changes
  client.js           NetClient: runs your player locally, mirrors the rest, interpolates
  online.js           OnlineSession: room codes, the lobby, character claims, start
  peer.js             PeerJS (WebRTC) and same-browser (BroadcastChannel) connections
  transport.js        a fake laggy network for the headless test
tests/                headless tests: node tests/<name>_headless.mjs (one per phase)
```

The simulation only takes **input commands** and produces **state + events**.
Rendering, audio and the HUD just read those. That separation is what let
online co-op drop in (see *Play online* and `src/net/`).

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
7. ✅ Fucci Gun, The Chopper, Stew Bomb, box movement (including a fifth box spot in the Quad)
8. ✅ Erik's PA taunts and intercom, the hidden Stew song Easter egg, lore, menus, full visual and sound polish
9. ✅ Online co-op for 2–4 players (lobby with room codes, browser-to-browser)
