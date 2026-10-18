// =============================================================================
// LORE — Call of the Crust: what everyone says out on the islands.
//
// Kearns, Ryan, Rocco and Brian came through the portal after Erik. Whoever
// you play talks out loud; the others are out on the islands on Pit's
// walkie-talkies. Pit's at his forge (his forge and power lines: PIT_FORGE and
// PIT_POWER in crew.js). Chops, Regs, P, James and Kyle hang in the Schnitz's
// cage over the Anvil and shout down at you: now and then, when something
// happens (CAGE_CALLS), and when you shoot the cage (CAGE_SHOT). The Schnitz has the speakers here
// (where Erik had the PA at the school), and it wants one of you over the edge.
//
// Read by src/sim/crew.js (the crew) and src/sim/pa.js (the Schnitz).
// Lines: { who, text }; `who` is a crew id (crew.js CREW) or 'schnitz'.
// =============================================================================

// The four out on the islands (any of them not being played is on the walkie)
export const CRUST_CREW = ['kearns', 'ryan', 'rocco', 'brian'];
// Who else can talk out here: Pit at his forge, the boys in the cage, Zach
// (once he's back) and the Schnitz
export const CRUST_VOICES = ['pit', 'chops', 'regs', 'p', 'james', 'kyle', 'zach', 'schnitz'];
// Shouting down from the cage (heard out loud, not on a walkie). James and Kyle
// can be played here too: whoever's being played isn't in the cage, so stays quiet.
export const CAGED = ['chops', 'regs', 'p', 'james', 'kyle'];

// ---------------------------------------------------------------------------
// The Schnitz on the speakers: the same moments Erik had, in its own words.
// ---------------------------------------------------------------------------
export const SCHNITZ_PA = {
  intro: [
    "Welcome to my house. Wipe your feet. Or don't. You won't be leaving.",
    "Five islands. Four titans. One cage. And you. This will be fun. For me.",
  ],
  round: [
    "More of my guests. Be polite. Let them eat.",
    "The dead out here have waited a long time for company.",
    "Another wave. I have so many.",
    "Out here, nobody can hear you scream. I checked.",
    "I collected these myself. Every island. Every century.",
    "Keep swinging. It's adorable.",
    "Your little blacksmith can't save you. He can barely save himself.",
    "The void is right there, boys. It's very peaceful.",
  ],
  milestone: {
    5: "Five rounds. Erik managed that too. Then he lost.",
    10: "Ten rounds in my house. I'm almost impressed. Almost.",
    15: "Fifteen. You're stubborn. The last ones were stubborn too. They're in the void now.",
    20: "Twenty rounds. Your bodies are tired. I can hear it.",
    25: "Twenty-five. Enough. Somebody jump.",
    30: "Thirty. I have forever. Do you?",
  },
  roundEnd: [
    "Catch your breath. Space doesn't have much of it.",
    "Still here? Hm.",
    "Rest. The cage isn't going anywhere. Neither are you.",
    "Take your time. I have all of it.",
    "Tick tock. Your friends are getting cold up there.",
    "Fine. One more.",
  ],
  cheddar: [
    "Here, boys. Supper.",
    "My dogs have been so patient. Let them play.",
  ],
  cheddarEnd: [
    "Good dogs. Mostly.",
    "Bad dogs. I'll get new ones.",
  ],
  boxMoved: [
    "The box doesn't like you either.",
    "Run after it. Run, run, run.",
  ],
  down: [
    "Down you go. Stay a while.",
    "Look at that. Gravity still works on you.",
    "Lie there. The view is lovely from the floor.",
    "One step closer to the edge.",
  ],
  revived: [
    "Back up? Pity.",
    "Picking each other up. Teamwork. Disgusting.",
    "Again with the getting up.",
  ],
  pressureCooker: [
    "Those were my guests!",
    "Rude. I raised those.",
    "Do you know how long those took to rot?",
  ],
  // someone steps off the edge for good
  fell: [
    "Into the void. That's one.",
    "Over the edge. Not the deal, but I'll take it.",
    "Oops.",
  ],
  // a round starting with all of you on one island
  island: {
    hub: ["Back in the forge pit. Pit can't help you, you know.", "The Anvil. My favourite rock. Watch the ramps."],
    ship: ["The Graveyard. My Captain's dreaming about you.", "The fog brings friends."],
    research: ["Mind the coils. Or don't.", "The Warden's been charging for this."],
    trench: ["My guns don't miss. Much.", "The Fiend's hungry. It's always hungry."],
    caves: ["Cold enough? It gets colder.", "The Golem's listening."],
  },
  idle: [
    "Do you hear that? Five boys swinging in the wind. Lovely sound.",
    "Erik was a disappointment. You won't be. You'll be dinner.",
    "I took your Zach. I'll take the rest one by one.",
    "Every island here used to be somebody's home. Now they're mine.",
    "One of you goes over the edge. I'm not picky about who.",
    "The little loud one. Rocco. He talks a lot, doesn't he.",
    "Your launchers. Your hammers. Your little forge. All in my house.",
    "Somewhere a dog is waiting by a door. Isn't that sad.",
    "I've been doing this since before your school had a gym.",
  ],
  gameOver: [
    "And that's the season. Thank you for playing.",
    "Over the edge, all of you. That wasn't the deal... but I'll allow it.",
    "Another team for my collection.",
    "This season is over. For you.",
  ],
};

// The Schnitz picking on whoever you're playing (mixed in with the above)
export const SCHNITZ_ROASTS = {
  kearns: [
    "Kearns. I've met a lot of unlucky people. You're the only one who's proud of it.",
    "Your sister stayed home, Kearns. All the family's brains went to her.",
    "Kearns, the iPad mini can't help you out here. No signal.",
  ],
  ryan: [
    "Strong man. Lift the cage, then. Go on. I'll wait.",
    "Maisy dog is going to wait by that door forever, Ryan.",
    "The Mad Dog. I've eaten bigger dogs than you.",
  ],
  rocco: [
    "Well well well. Rocco. You'd make a lovely sacrifice. Small. Easy to throw.",
    "Shut up, Lumpy. Everyone says it. Now I see why.",
    "Rocco, nobody would miss you. I asked around.",
  ],
  brian: [
    "Brian. You came through my portal without asking. Rude.",
    "You never panic, Brian. Let's fix that.",
    "Calm. Quiet. Annoying. Erik said the same about you.",
  ],
};

// ---------------------------------------------------------------------------
// Reactions: what your character says out loud (all their own out here: none
// of the school's carry over).
// ---------------------------------------------------------------------------
export const CRUST_REACT = {
  multiKill: {
    kearns: ["Did that just... go RIGHT for me? In SPACE?", "Somebody write that down. Kearns, good luck, one time, on a rock.", "Back to the void, you freaks."],
    ryan: ["Strong man! STRONG MAN!", "That's what a Mad Dog does. Even up here.", "Stack 'em up, boys. Off the edge they go."],
    rocco: ["Well well WELL!", "That's a highlight. Space highlight.", "Did the cage see that? Somebody tell the cage."],
    brian: ["Clean.", "Too easy.", "Next."],
  },
  knife: {
    kearns: ["Up close and personal. Space gross.", "I'm gonna need to wash this hand. In what? There's no water. It's all ice."],
    ryan: ["Hands on. Just how I like it.", "That's a Mad Dog bite."],
    rocco: ["Shank city, baby. Crust edition.", "Little guy, big knife."],
    brian: ["Quiet way.", "No ammo needed."],
  },
  revived: {
    kearns: ["Back up. Still unlucky. Still in space.", "Thanks. Don't tell the Schnitz."],
    ryan: ["Strong man's back.", "Can't keep a Mad Dog down. Not even out here."],
    rocco: ["Well well well. Look who's alive.", "Respawned. Like 2K. Space 2K."],
    brian: ["Appreciated.", "Back in."],
  },
  dryFire: {
    kearns: ["Out of ammo. Naturally. In space.", "Click. CLICK. Why is it always me?"],
    ryan: ["Empty! Gotta reload or punch something.", "Out! Somebody check the box!"],
    rocco: ["Click click click. That's not good.", "Out! Out out out!"],
    brian: ["Empty.", "Switching."],
  },
  hurt: {
    kearns: ["They always go for me! Even the space ones!", "Ow! My tomato foot!"],
    ryan: ["Hit me harder, see what happens!", "That's gonna leave a crater."],
    rocco: ["Hey! Pick on someone your own size!", "Ow! Lumpy got hit!"],
    brian: ["Getting close.", "Back off."],
  },
  boxGood: {
    kearns: ["No way. Something went right for me. Out here.", "I'm keeping this. Forever. Like my iPad."],
    ryan: ["Now THAT'S a weapon.", "Strong gun for a strong man."],
    rocco: ["Well well well. Look what Lumpy pulled.", "Legendary pull. Space legendary."],
    brian: ["This'll do.", "Nice."],
  },
  perk: {
    kearns: ["Tastes like soup. Space soup.", "Feeling lucky. Which is new. And weird."],
    ryan: ["Mmm. Protein.", "Now we're cooking. Thanks for the power, Pit."],
    rocco: ["Spicy! Lumpy likes it spicy.", "Well well well. Island soda."],
    brian: ["Better.", "Ready."],
  },
  cheddar: {
    kearns: ["Dogs. On a floating rock. It had to be dogs.", "Why do they always smell like cheese?"],
    ryan: ["Here, doggy doggy. Mad Dog wants to play.", "No offense to Maisy, but these ones go over the edge."],
    rocco: ["Well well well. Space cheese dogs.", "Sit! ...nope, they don't sit."],
    brian: ["Dogs. Aim low.", "Watch the edges. They don't."],
  },
  roundStart: {
    kearns: ["Space zombies. Of course it's space zombies.", "I can see the whole galaxy and it's still my bad day.", "Kearnita's home eating cereal right now. Lucky."],
    ryan: ["Let's go. Strong man in space.", "Maisy, daddy's in space. Daddy's still coming home.", "Line 'em up, boys."],
    rocco: ["Well well well. Space round.", "This is like 2K. If 2K had a void.", "Bring it, crusties."],
    brian: ["Here they come.", "Watch the edges.", "Next wave."],
  },
  down: {
    kearns: ["I'm down! At least I didn't fall off. Yet.", "Of course it's me. In SPACE.", "Tell Kearnita... she was right."],
    ryan: ["Strong man's down! Get me up before I roll off!", "Maisy... daddy's on the floor...", "Ugh. Space hits harder."],
    rocco: ["Lumpy's down! I mean Rocco! Rocco's down!", "Somebody pick me up, I'm small, I'm light!", "Don't throw me off! I'm just resting!"],
    brian: ["Down. Get me up.", "Not out here."],
  },
  boxBad: {
    kearns: ["Typical. Even the box in space hates me.", "The box left. Floated off. Probably happier."],
    ryan: ["Box ran away. Smart box.", "Come back here, box!"],
    rocco: ["Rigged. Rigged in space.", "That's what happens in 2K too. Rigged."],
    brian: ["Fine. We'll find it."],
  },
  launch: {
    kearns: ["Please don't miss. Please don't miss.", "I'm gonna throw up. I'm gonna throw up in space.", "WHY do we have to do it like THIS?"],
    ryan: ["STRONG MAAAAN!", "Woo! Maisy should see this!", "Send it!"],
    rocco: ["Well well wellllll!", "Wheeee! I'm Lumpy! I'm flying!", "Like a 2K dunk contest!"],
    brian: ["Going over.", "Nice view.", "Hold on."],
  },
  hammer: {
    kearns: ["A hammer. Finally, something that doesn't miss.", "It's heavy. It's so heavy. I love it."],
    ryan: ["Now THIS is a strong man weapon.", "Hammer time. Mad Dog time."],
    rocco: ["Well well well. Thor who?", "Lumpy with a hammer. Everybody run."],
    brian: ["Good balance.", "This'll work."],
  },
  zip: {
    kearns: ["This cable better hold. It won't. But it better.", "Oh no oh no oh no."],
    ryan: ["Zip line! Hands free, baby!", "Strong man's got a grip!"],
    rocco: ["Wheeee!", "Well well WELL!"],
    brian: ["Going down.", "Covering you."],
  },
};
export const CRUST_REACT_CHANCE = { launch: 0.55, hammer: 0.9, zip: 0.5, place: 1, islandRound: 0.6 };

// Round start, on a particular island (instead of the plain round-start line,
// most of the time)
export const CRUST_ISLAND_REACT = {
  hub: {
    kearns: ["Back in the hole. My favourite hole.", "The Anvil again. At least Pit's here."],
    ryan: ["Hold the pit, boys.", "Pit, keep the forge hot. We got company."],
    rocco: ["Well well well. Forge round.", "They're climbing down the ramps! Like ants! Gross ants!"],
    brian: ["Watch the ramps.", "Up on the terraces. Better angles."],
  },
  ship: {
    kearns: ["The fog's rolling in off the wrecks. Great.", "Something's coming up the pier. Of course it is."],
    ryan: ["Hold the village, boys!", "Smells like fish and dead guys."],
    rocco: ["Ahoy, ugly!", "Well well well. Pirate zombies."],
    brian: ["Covering the pier.", "Up on the roofs. Watch the shore."],
  },
  research: {
    kearns: ["Everything in here is sparking. That's fine. That's normal.", "Please don't let the robot wake up. Please."],
    ryan: ["Hold the labs!", "Lab zombies. Smart ones? Hope not."],
    rocco: ["Well well well. Science round.", "They're coming through the airlock!"],
    brian: ["Watch the corridor.", "Stay off the catwalks till it's clear."],
  },
  trench: {
    kearns: ["It's so HOT. Why is the lava hot. Why is there lava.", "Stay in the trench, stay in the trench..."],
    ryan: ["Hold the line, boys! Literally, the line!", "Keep your head down. Those guns don't care who you are."],
    rocco: ["Well well well. Barbecue round.", "Trench warfare! Like the history channel!"],
    brian: ["Stay low.", "Hold the fort."],
  },
  caves: {
    kearns: ["It's so cold my teeth are chattering in Morse code.", "Don't slip. Don't slip. I slipped."],
    ryan: ["Hold the cavern!", "Cold doesn't scare the strong man."],
    rocco: ["Well well well. Snow round.", "My lumps are freezing. Every single lump."],
    brian: ["Watch the shelves.", "Keep moving. Stay warm."],
  },
};

// The first time anyone gets to these places, whoever's there says something
// (and maybe someone answers on the walkie). Keyed by zone.
export const CRUST_PLACES = {
  scaffold: { kearns: "Catwalks. Over a pit. Wobbly ones. Love it.", ryan: "Good view of the forge from up here.", rocco: "I can see Pit's bald spot from up here!", brian: "High ground. Good.", reply: { who: 'pit', text: "That's not a bald spot, man. That's a forge tan." } },
  depot: { kearns: "A supply depot. With supplies? No. Of course not.", ryan: "Depot. There's a perk machine in here!", rocco: "Well well well. Space Costco.", brian: "Depot's clear." },
  lighthouseGallery: { kearns: "Top of the lighthouse. Lighthouses are good luck. I'm calling it.", ryan: "You can see the whole graveyard from up here.", rocco: "I'm the lighthouse now. BWAAAMP.", brian: "Good sight lines. I can see the Captain." },
  galleon: { kearns: "We're on a pirate ship. In space. On a rock.", ryan: "Big boat. Big dead boat.", rocco: "I'm the captain now! Captain Lumpy!", brian: "Galleon's quiet. For now.", reply: { who: 'ryan', text: "You're not the captain, Lumpy." } },
  capsized: { kearns: "We're inside an upside-down ship. Everything is upside-down. Even my luck. Wait.", ryan: "Hull's solid. Good spot to hold.", rocco: "Upside-down boat! Upside-down Rocco!", brian: "Tight in here. Watch both ends." },
  mast: { kearns: "This mast is very tall and I am very not okay with it.", ryan: "Top of the radio mast! Strong man in the sky!", rocco: "Hello? Hello? Is this thing on? Can I call 2K support?", brian: "Mast's up. Whole base in view." },
  dome: { kearns: "An observatory. Look, stars. Stars everywhere. Too many stars.", ryan: "Big telescope. Point it at home.", rocco: "I can see my house from here! No I can't.", brian: "Observatory's clear." },
  teslayard: { kearns: "Giant tesla coils. Of course. Nothing bad has ever happened near a tesla coil.", ryan: "These coils are humming. That's the robot's weak spot.", rocco: "My hair's standing up! Well, more than usual!", brian: "Coils. Remember them for the Warden." },
  fort1: { kearns: "The fort. Walls. Finally, walls.", ryan: "Hold the fort, boys. I've always wanted to say that.", rocco: "There's a phone in here! Can I order a pizza?", brian: "Phone's live. It calls the guns off." },
  nomansland: { kearns: "Why am I up here? I'm not supposed to be up here!", ryan: "No man's land! Get down, get down!", rocco: "Well well well. Bad idea. This is a bad idea.", brian: "Exposed. Moving through." },
  gunpitW: { kearns: "A field gun. I'm not touching it. I'm touching it.", ryan: "Field guns! Point 'em at the crater!", rocco: "BOOM. Can I BOOM? I'm gonna BOOM.", brian: "Guns are good. Crater's in range." },
  gunpitE: { kearns: "Another gun. Twice the chances for this to go wrong.", ryan: "East gun's ready!", rocco: "Two guns! Double BOOM!", brian: "East gun. Covering the crater." },
  cavern: { kearns: "It's so big in here. And so cold. And so dark.", ryan: "Great cavern. Look at the icicles on the roof.", rocco: "ECHO! Echo! echo...", brian: "Big clusters on the ceiling. Those'll drop." },
  falls: { kearns: "Frozen waterfall. Steps cut in the ice. Who cut them? Nobody wants to know.", ryan: "Up the falls! Watch your feet!", rocco: "I'm an ice climber now!", brian: "Falls lead to the summit." },
  summit: { kearns: "There's a golem up here. A sleeping golem. Everyone be quiet.", ryan: "Wind Summit. There's the Golem.", rocco: "HELLO, GOLEM!", brian: "Golem's asleep. Let's keep it that way. For now.", reply: { who: 'kearns', text: "ROCCO." } },
  mine: { kearns: "An old mine. Collapsed. Like my hopes.", ryan: "Mine's tight. Watch your heads.", rocco: "Diamonds? Any diamonds? No diamonds.", brian: "Mine's clear." },
  lake: { kearns: "A frozen lake. If it cracks, I'm going first. I always go first.", ryan: "Frozen lake. Careful.", rocco: "Ice skating! Wheee!", brian: "Big icicles over the lake too." },
};

// Someone on the walkie answering a reaction (the Crust's own)
export const CRUST_RADIO = {
  roundStart: [
    { who: 'rocco', text: "Well well well. Here they come, ladies." },
    { who: 'ryan', text: "Everybody check in. Who's on what island?" },
    { who: 'pit', text: "More of 'em, man. I can hear 'em climbing the ramps." },
    { who: 'kearns', text: "Is anybody else's walkie full of space static? Mine's full of space static." },
  ],
  multiKill: [
    { who: 'rocco', text: "Was that you? Whoever that was, well well well." },
    { who: 'ryan', to: 'kearns', text: "Kearns did that? Somebody check if he's okay." },
    { who: 'pit', text: "Heard that from the forge, man. That was loud." },
    { who: 'brian', text: "Nice." },
  ],
  boxBad: [
    { who: 'ryan', to: 'kearns', text: "The box ran from Kearns. Even the space box knows." },
    { who: 'rocco', to: 'kearns', text: "Worst luck on five islands. Carrot farmer strikes again." },
  ],
  boxGood: [
    { who: 'rocco', text: "What'd you get? Gimme. I'll trade you my spot in the cage line." },
    { who: 'kearns', to: 'ryan', text: "Ryan got the good gun. Of course Ryan got the good gun." },
  ],
  perk: [
    { who: 'pit', text: "Power's good for something, man." },
  ],
  down: [
    { who: 'rocco', to: 'kearns', text: "Kearns is down. In space. That's new, even for you." },
    { who: 'kearns', to: 'rocco', text: "Rocco's down. Should we... leave him? Just asking." },
    { who: 'brian', text: "Hold on. I'm coming." },
  ],
  launch: [
    { who: 'ryan', to: 'kearns', text: "Kearns, stop screaming on the channel!" },
    { who: 'kearns', to: 'rocco', text: "Who launched Rocco? Do we have to bring him back?" },
    { who: 'pit', text: "Saw you fly over, man. You looked like a bird. A scared bird." },
    { who: 'rocco', to: 'ryan', text: "Strong man's flying! Strong man's flying!" },
  ],
  hammer: [
    { who: 'pit', text: "Swing it like you mean it, man. It likes that." },
    { who: 'ryan', to: 'rocco', text: "Who gave Rocco a hammer?! Everybody duck." },
  ],
};
// when somebody goes over the edge for good: someone else on the walkie
export const CRUST_FELL = [
  { who: 'ryan', text: "Did somebody just fall off the island?!" },
  { who: 'kearns', text: "Somebody went over. Was it me? It feels like it was me." },
  { who: 'rocco', text: "Well well well. Down they go." },
  { who: 'brian', text: "Man overboard. Watch the edges." },
  { who: 'pit', text: "Saw something fall past the forge, man. Hope it wasn't a friend." },
];

// ---------------------------------------------------------------------------
// The story: a conversation at each beat. Keyed by beat.
// ---------------------------------------------------------------------------
export const CRUST_TALKS = {
  // round 1, after Pit's hello: everyone checks in on his walkies
  intro: [
    { who: 'ryan', text: "Radio check. Pit, where'd you even get walkie-talkies?" },
    { who: 'pit', text: "Traded a guy, man. A space guy. Don't ask." },
    { who: 'rocco', text: "Well well well. Rocco here. I'm at the bottom of a giant hole. Love that for me." },
    { who: 'kearns', text: "Kearns. Something already bit my shoe. In space. That's a first." },
    { who: 'brian', text: "Brian. I can see the cage from here. They're okay. For now." },
    { who: 'chops', text: "WE CAN HEAR YOU! HELLO! WE'RE UP HERE!" },
    { who: 'regs', text: "Can somebody please get us down? I'm not a heights guy!" },
    { who: 'p', text: "Can somebody bring snacks? Any snacks? I'd eat a space rock if it had seasoning." },
    { who: 'james', text: "No rush, boys. I'm comfortable. Been dancing to keep warm." },
    { who: 'kyle', text: "He's been twerking. For hours. In a crate. I'm judging every second of it." },
    { who: 'ryan', text: "Hang tight, boys. We're coming." },
    { who: 'schnitz', text: "Take your time. They're not going anywhere." },
  ],
  // the first burnt relay pulled
  relay: [
    { who: 'kearns', text: "Got a relay. It's burnt. It smells like my hair after the last game." },
    { who: 'ryan', text: "Get it to Pit. Then we can actually leave this hole." },
    { who: 'rocco', text: "Can I lick it? I'm gonna lick it." },
    { who: 'ryan', text: "Shut up, Lumpy." },
  ],
  // the Anvil's power comes on
  power: [
    { who: 'rocco', text: "Lights! Well well well, look at that." },
    { who: 'kearns', text: "Something worked. First try. I don't trust it." },
    { who: 'ryan', text: "Launchers are live. Let's go get those hammer pieces." },
    { who: 'brian', text: "Spread out. One island each, if you can." },
    { who: 'schnitz', text: "Power. Cute. Light up the whole rock. It won't help you." },
  ],
  // the first launch
  launch: [
    { who: 'ryan', text: "Somebody's in the air! Woo!" },
    { who: 'kearns', text: "Tell me when they land. Tell me IF they land." },
    { who: 'pit', text: "Launchers are good, man. Probably. I fixed 'em. Mostly." },
  ],
  // the first time anyone lands on each island
  land_ship: [
    { who: 'rocco', text: "Ship graveyard. Smells like old fish. And older fish." },
    { who: 'kearns', text: "There's a lighthouse. Lighthouses are good luck. Right? Right?" },
    { who: 'pit', text: "The Captain's out there, man. Big guy. Wet guy. Don't wake him 'til you're ready." },
  ],
  land_research: [
    { who: 'ryan', text: "Research base. Everything in here is sparking." },
    { who: 'brian', text: "Something big's powered down by the helipad. Leave it for now." },
    { who: 'rocco', text: "Well well well. Science. I hate science." },
  ],
  land_trench: [
    { who: 'kearns', text: "It's on FIRE. The whole island is on fire." },
    { who: 'ryan', text: "Stay in the trenches. Up top, they're shelling everything." },
    { who: 'pit', text: "There's a phone in the fort, man. Call 'em. Ask nice." },
  ],
  land_caves: [
    { who: 'rocco', text: "It's freezing! My lumps are freezing!" },
    { who: 'brian', text: "Big cavern. Icicles overhead. Remember that." },
    { who: 'kearns', text: "I slipped. I slipped already. I just got here." },
  ],
  // the first piece of the War Hammer
  part: [
    { who: 'ryan', text: "Got a piece of the hammer!" },
    { who: 'pit', text: "Yeah, man! Bring it home. The stand's up on the dais." },
    { who: 'rocco', text: "How heavy is it? Is it Lumpy heavy?" },
  ],
  // the War Hammer's whole
  hammer: [
    { who: 'ryan', text: "The War Hammer. Now we're talking." },
    { who: 'kearns', text: "It's huge. Can I have one? I'm having one." },
    { who: 'brian', text: "One each. Then we go for the titans." },
    { who: 'schnitz', text: "Iron. How quaint. My titans have eaten iron." },
  ],
  // each titan wakes
  wake_ship: [
    { who: 'kearns', text: "The ship's moving. Why is the SHIP moving?!" },
    { who: 'ryan', text: "Something's in its mouth! It's spitting zombies!" },
    { who: 'schnitz', text: "Captain. Company." },
  ],
  wake_research: [
    { who: 'rocco', text: "The robot's awake! The big robot's awake!" },
    { who: 'brian', text: "Lead it past a charged coil. Make it pay." },
    { who: 'schnitz', text: "Warden. Escort them out." },
  ],
  wake_caves: [
    { who: 'ryan', text: "The ice is walking! The ICE is walking!" },
    { who: 'pit', text: "Drop the icicles on it, man! Shoot the big ones on the ceiling!" },
    { who: 'schnitz', text: "Golem. Hold them still." },
  ],
  wake_trench: [
    { who: 'kearns', text: "Something's crawling out of the crater. Of course it is." },
    { who: 'ryan', text: "Get on the field guns! Shell that thing!" },
    { who: 'schnitz', text: "Fiend. Feed." },
  ],
  // each titan falls (the boys in the cage are watching)
  down_ship: [
    { who: 'rocco', text: "The Captain's down! Well well well!" },
    { who: 'chops', text: "YEAH! GET 'EM!" },
  ],
  down_research: [
    { who: 'ryan', text: "The Warden's scrap! STRONG MAN!" },
    { who: 'regs', text: "Nice one, guys! I'm so proud of you!" },
  ],
  down_caves: [
    { who: 'kearns', text: "We beat the ice. I'm still cold. But we beat it." },
    { who: 'p', text: "Nice! Somebody DoorDash me a celebration burrito! Do they deliver to cages?" },
  ],
  down_trench: [
    { who: 'brian', text: "Fiend's down." },
    { who: 'schnitz', text: "You broke my Fiend. I liked my Fiend." },
  ],
  // the first War Hammer forged
  forged: [
    { who: 'rocco', text: "Dibs. DIBS." },
    { who: 'kearns', text: "You can't dibs a hammer, Rocco." },
    { who: 'rocco', text: "I just did." },
  ],
  // all four forged
  allForged: [
    { who: 'ryan', text: "Four hammers. Four titans down." },
    { who: 'kearns', text: "So we ring the Anvil and... Zach comes? Big Zach?" },
    { who: 'pit', text: "Big Evil Zach, man. Hit him with the one he glows." },
    { who: 'brian', text: "Let's get our friend back." },
    { who: 'schnitz', text: "Ring it. I dare you." },
  ],
  // Big Evil Zach comes down
  zach: [
    { who: 'ryan', text: "ZACH! It's me! It's Ryan!" },
    { who: 'kearns', text: "That's not Zach. That's the Schnitz wearing Zach." },
    { who: 'rocco', text: "He's huge! Why is he huge?!" },
    { who: 'regs', text: "Don't hurt him too bad! He's still in there!" },
  ],
  // he goes down on one knee the first time
  zachHalf: [
    { who: 'chops', text: "It's working! Keep going!" },
    { who: 'kearns', text: "Hit him with the colour he's glowing! The glowing! Whatever!" },
  ],
  // the first Cheddar Round out here
  cheddar: [
    { who: 'ryan', text: "Dogs. In space. Maisy would be so confused." },
    { who: 'rocco', text: "Cheese dogs! Space cheese dogs!" },
    { who: 'pit', text: "I'm more of a horse guy, man." },
  ],
  // the first shell coming in over the Trench Front
  shells: [
    { who: 'kearns', text: "Something's whistling. Why is something whistling?" },
    { who: 'ryan', text: "INCOMING! Get in the trench!" },
  ],
  // the field telephone
  ceasefire: [
    { who: 'rocco', text: "Hello? Yes. We'd like a ceasefire. And a pizza." },
    { who: 'brian', text: "Guns are quiet. Move." },
  ],
  // the first zipline or ice slide
  zip: [
    { who: 'rocco', text: "Zip line! Zip line! ZIP LINE!" },
    { who: 'kearns', text: "If this snaps, I'm haunting all of you." },
  ],
};

// Between rounds, now and then
export const CRUST_BANTER = [
  [
    { who: 'rocco', text: "So. The Schnitz wants one of us to go over the edge." },
    { who: 'kearns', text: "Yep." },
    { who: 'rocco', text: "Why is everybody looking at me?" },
    { who: 'ryan', text: "Nobody's looking at you, Lumpy." },
    { who: 'brian', text: "I'm looking at you." },
  ],
  [
    { who: 'regs', text: "Guys? Is it normal for the cage to creak like that?" },
    { who: 'chops', text: "It's fine, Regs. It's totally fine." },
    { who: 'p', text: "It's not fine. I think it's me. I had four sandwiches before the portal." },
    { who: 'regs', text: "P!" },
  ],
  [
    { who: 'kearns', text: "Ryan. If we die out here, I want the iPad mini buried with me." },
    { who: 'ryan', text: "It's MY iPad, Kearns." },
    { who: 'kearns', text: "Then you can be buried with it too." },
  ],
  [
    { who: 'ryan', text: "How long you think Maisy's been waiting by the door?" },
    { who: 'kearns', text: "Like a week? Is time even the same out here?" },
    { who: 'pit', text: "Time's weird here, man. I been here like... a year. Or a Tuesday." },
  ],
  [
    { who: 'rocco', text: "You know what this is like? 2K. In space." },
    { who: 'chops', text: "There's no 2K in space, Rocco!" },
    { who: 'rocco', text: "There should be." },
    { who: 'regs', text: "I'd play." },
    { who: 'p', text: "Only if there's snacks." },
  ],
  [
    { who: 'pit', text: "I made a sword yesterday, man. Then I made it a hammer. Then I made it a sword again." },
    { who: 'ryan', text: "Pit. Focus." },
    { who: 'pit', text: "(whinnies) ...sorry. Focusing." },
  ],
  [
    { who: 'chops', text: "When we get down, first thing, we're getting the best table on the patio." },
    { who: 'regs', text: "And mozzarella sticks!" },
    { who: 'chops', text: "And mozzarella sticks." },
    { who: 'p', text: "And a large fries. Two large fries. And a shake. Actually, just bring me the whole menu." },
  ],
  [
    { who: 'kearns', text: "Does anybody else think Zach's gonna be really chill about all this?" },
    { who: 'ryan', text: "Zach's chill about everything." },
    { who: 'rocco', text: "Zach would be happy to get eaten. 'I'm so happy to be here!'" },
    { who: 'kearns', text: "...Yeah. That's Zach." },
  ],
  [
    { who: 'brian', text: "Rocco. You talk a lot." },
    { who: 'rocco', text: "Thank you." },
    { who: 'brian', text: "It wasn't a compliment." },
  ],
  [
    { who: 'regs', text: "Hey Pit! Thanks for the forge stuff! You're doing great!" },
    { who: 'pit', text: "Thanks, Regs. You're doing great too, man. Hanging in there." },
    { who: 'regs', text: "Literally!" },
  ],
  [
    { who: 'kearns', text: "I just realised. We're in space. And I still stubbed my toe." },
    { who: 'ryan', text: "Tomato foot." },
    { who: 'kearns', text: "That's not even a THING, Ryan." },
  ],
  [
    { who: 'rocco', text: "Hey, Schnitz. Hey. Schnitz. Hey." },
    { who: 'schnitz', text: "...What." },
    { who: 'rocco', text: "Well well well." },
    { who: 'schnitz', text: "When it's time, I'm choosing you." },
  ],
  [
    { who: 'p', text: "If I had one bar of signal. One bar. I'd DoorDash a whole pizza to this cage." },
    { who: 'chops', text: "P, they don't deliver to space." },
    { who: 'p', text: "Then what's even the point of space?" },
  ],
  [
    { who: 'james', text: "Chops. Watch this." },
    { who: 'chops', text: "James, there is NO room to twerk in here!" },
    { who: 'james', text: "There's always room." },
    { who: 'kyle', text: "I've seen enough. Guilty." },
  ],
  [
    { who: 'kyle', text: "Something in this cage smells." },
    { who: 'regs', text: "Kyle, buddy... it's you." },
    { who: 'kyle', text: "I know. I'm still judging whoever it is." },
  ],
  [
    { who: 'rocco', text: "Hey P, what's the first thing you're doing when you get down?" },
    { who: 'p', text: "Eating." },
    { who: 'rocco', text: "And the second thing?" },
    { who: 'p', text: "Eating something else." },
  ],
  [
    { who: 'ryan', text: "Brian. Real talk. How'd you get through that portal?" },
    { who: 'brian', text: "Walked." },
    { who: 'ryan', text: "...Okay." },
  ],
];

// Between rounds on a particular island (when everyone's on it)
export const CRUST_ISLAND_BANTER = {
  ship: [
    [
      { who: 'kearns', text: "Does anybody else hear singing? Out in the fog? Sea shanty singing?" },
      { who: 'ryan', text: "That's the Captain. Snoring." },
      { who: 'rocco', text: "Snoring in tune. Respect." },
    ],
    [
      { who: 'rocco', text: "If I find treasure on the galleon, it's mine." },
      { who: 'brian', text: "If you find treasure, the Schnitz put it there." },
      { who: 'rocco', text: "...Then it's yours." },
    ],
  ],
  research: [
    [
      { who: 'kearns', text: "There's a whiteboard in the lab that says 'DO NOT WAKE THE WARDEN.'" },
      { who: 'ryan', text: "So we're gonna wake the Warden." },
      { who: 'kearns', text: "We're definitely gonna wake the Warden." },
    ],
    [
      { who: 'rocco', text: "The mess hall's got pudding cups. Space pudding." },
      { who: 'pit', text: "Bring me one, man. Chocolate." },
      { who: 'rocco', text: "It's all vanilla. I ate the chocolate." },
    ],
  ],
  trench: [
    [
      { who: 'ryan', text: "Every time a shell lands I think of Maisy hiding under the couch on the Fourth of July." },
      { who: 'kearns', text: "Same. Except I'm the one under the couch." },
    ],
    [
      { who: 'rocco', text: "I called the guns off on the phone. They said 'who is this.'" },
      { who: 'brian', text: "What'd you say?" },
      { who: 'rocco', text: "'Well well well.' They hung up." },
    ],
  ],
  caves: [
    [
      { who: 'kearns', text: "My eyelashes are frozen. Is that bad? That feels bad." },
      { who: 'ryan', text: "Walk it off." },
      { who: 'kearns', text: "I can't feel my legs to walk it off, Ryan." },
    ],
    [
      { who: 'rocco', text: "I licked the ice wall. My tongue's stuck. Well well wellll." },
      { who: 'brian', text: "Leave him." },
      { who: 'ryan', text: "...Tempting." },
    ],
  ],
};

// The boys in the cage, when you're up near it (one of these at a time)
export const CAGE_TALK = [
  [{ who: 'chops', text: "Hey! HEY! Down here! Up here! Wherever you are!" }],
  [{ who: 'regs', text: "Hi guys! Don't look down. I looked down. Big mistake." }],
  [{ who: 'p', text: "Hey! If anybody finds a vending machine down there, I'll pay you back! Probably!" }],
  [{ who: 'p', text: "I've been refreshing DoorDash for three hours. It just says 'no drivers in your galaxy.'" }],
  [{ who: 'p', text: "Pit! Can you forge me a sandwich? A big one?" }, { who: 'pit', text: "I can't forge a sandwich, man. ...I could try." }],
  [{ who: 'p', text: "I'm so hungry I can hear my stomach over the zombies." }, { who: 'kyle', text: "We can all hear it, P." }],
  [{ who: 'james', text: "Don't mind me. Just up here being the best-looking guy in the cage." }, { who: 'kyle', text: "Debatable." }],
  [{ who: 'james', text: "You can't see it from down there, but I'm twerking right now. Trust me." }],
  [{ who: 'james', text: "Five guys, one cage, and I'm still the calmest one in it." }],
  [{ who: 'kyle', text: "I've been watching you guys play. I've seen better. I've seen a lot better." }],
  [{ who: 'kyle', text: "Whoever keeps missing: I'm writing it down." }],
  [{ who: 'regs', text: "Kyle, have you showered since the school?" }, { who: 'kyle', text: "...Define showered." }],
  [{ who: 'chops', text: "Hey Pit! Nice apron! Did you make it out of a horse?" }, { who: 'pit', text: "It's leather, man. Leave me alone." }],
  [{ who: 'james', text: "Yo Pit, you whinnied in your sleep last night. We all heard it." }, { who: 'pit', text: "I don't do that." }, { who: 'kyle', text: "You did that." }],
  [{ who: 'p', text: "Pit, is that forge hot enough for a grilled cheese? Asking for me." }],
  [{ who: 'chops', text: "Is that Rocco? Hi, Rocco!" }, { who: 'regs', text: "Hi, Rocco!" }],
  [{ who: 'regs', text: "Is anyone getting us down? No rush! Kind of a rush." }],
  [{ who: 'chops', text: "Somebody tell the Schnitz this cage is NOT up to code." }],
  [{ who: 'chops', text: "P keeps trying to eat the bars." }, { who: 'p', text: "They're iron. Iron's a nutrient." }],
  [{ who: 'regs', text: "I made friends with a space bird. It left." }],
  [{ who: 'chops', text: "We can see everything from up here! A giant ship! A fire island! It's kind of beautiful!" }, { who: 'regs', text: "It's terrifying!" }],
  [{ who: 'chops', text: "Bring the hammers! Smash something! Smash the Schnitz!" }],
];

// The boys in the cage calling out what's happening below (src/sim/crew.js
// cageCall), one at a time, when you're on the Anvil. {name}: who it's about;
// {round}: the round. A line from someone being played is skipped.
export const CAGE_CALLS = {
  round: [
    { who: 'chops', text: "Here they come! Round {round}! Let's GO!" },
    { who: 'regs', text: "Round {round}! You've got this, guys! Probably!" },
    { who: 'james', text: "Round {round}. Stay calm. Be like me." },
    { who: 'kyle', text: "Round {round}. I'm grading this one." },
    { who: 'p', text: "Another round? Of what? Food? No? Then I'm not interested." },
  ],
  power: [
    { who: 'chops', text: "LIGHTS! Somebody got the lights on! I can see you guys!" },
    { who: 'p', text: "Power's on! Does that mean the microwave works? Is there a microwave?" },
    { who: 'kyle', text: "Power's on. Took you long enough." },
  ],
  part: [
    { who: 'regs', text: "{name} found a piece of the hammer! So proud of you, buddy!" },
    { who: 'james', text: "Smooth pickup, {name}. Not as smooth as me, but smooth." },
    { who: 'p', text: "{name} found something! Is it food? ...It's a hammer. Never mind." },
  ],
  titan: [
    { who: 'chops', text: "Something BIG just woke up! I can see it from here!" },
    { who: 'regs', text: "Oh no. Oh no no no. That's huge. Be careful, guys!" },
    { who: 'kyle', text: "That's a titan. You're gonna lose. I'm just saying what we're all thinking." },
    { who: 'p', text: "If you kill that thing, can we eat it? Asking for me." },
  ],
  down: [
    { who: 'regs', text: "{name}'s down! Somebody help {name}!" },
    { who: 'chops', text: "{name}! Get UP, man! GET UP!" },
    { who: 'kyle', text: "{name} went down. Noted." },
    { who: 'p', text: "{name}'s down! Does he have any snacks on him? Just checking." },
    { who: 'james', text: "Get back up, {name}. Lying down's not a good look." },
  ],
  revived: [
    { who: 'regs', text: "{name}'s back up! YAY!" },
    { who: 'james', text: "There he is. Shake it off, {name}." },
  ],
  ammo: [
    { who: 'chops', text: "{name}'s out of ammo! RELOAD! RELOAD!" },
    { who: 'kyle', text: "I can hear you clicking from up here, {name}." },
    { who: 'james', text: "Easy, {name}. Reload. Smooth, like me." },
    { who: 'p', text: "{name}, you're out! Like me with snacks!" },
  ],
  hammer: [
    { who: 'chops', text: "{name} has a WAR HAMMER! Smash 'em!" },
    { who: 'james', text: "Big hammer, {name}. Respect." },
    { who: 'p', text: "{name}, if that hammer can open a vending machine, you know where I am." },
  ],
  // (someone just shot Pit)
  pit: [
    { who: 'james', text: "HA! Shoot him again!" },
    { who: 'kyle', text: "Shooting Pit. Honestly? I support it." },
    { who: 'p', text: "Don't shoot Pit! He's the only one down there who can cook!" },
    { who: 'chops', text: "Leave Pit alone! He's doing his best!" },
  ],
};

// Shooting the cage (src/sim/cageShot.js): whoever's in there that you hit
// says so. first: the first shot or two; again: you kept going; lots: you
// really kept going. One each per tier, taking turns.
export const CAGE_SHOT = {
  first: {
    chops: "WHOA! HEY! We're IN here!",
    regs: "Ow! That pinged right off the bars! Not cool, guys!",
    p: "Hey! You almost hit my snack! ...I don't have a snack. But if I did.",
    james: "Easy. You'll mess up the hair.",
    kyle: "You shot at the cage. I'm judging that. Harshly.",
  },
  again: {
    chops: "Stop shooting the cage! The zombies are DOWN THERE!",
    regs: "Please stop! I'm already scared of heights!",
    p: "If you hit the chain, I'm landing on you. I'm heavy. You've been warned.",
    james: "Still dancing. You can't stop this.",
    kyle: "That's two. I'm keeping count.",
  },
  lots: {
    chops: "Okay, WHO is it? Who keeps shooting us?",
    regs: "I thought we were friends!",
    p: "I'm gonna DoorDash a bullet to YOUR house.",
    james: "You're just mad you can't move like me.",
    kyle: "Guilty. All of you. Every single one of you is guilty.",
  },
};

// Big Evil Zach (the Schnitz wearing him), now and then through the fight
export const ZACH_TAUNTS = [
  "Your friend is still in here. Somewhere. Hit harder.",
  "He's so happy in here. Can't you tell?",
  "Stomp, stomp. Those are his feet, by the way.",
  "Bring the hammers closer. I want to see them.",
  "He keeps saying 'I'm so happy to be here.' It's driving me mad.",
  "Every hit hurts him too. Probably. Keep going.",
];
