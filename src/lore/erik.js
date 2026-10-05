// =============================================================================
// LORE — Stew Leonard High: Out of Bounds. (Story by James Amarante.)
//
// The Stew Leonards were an unstoppable high school basketball team heading
// into the championship game off an undefeated season. Behind closed doors,
// friction brewed, and right before the final stretch the team voted,
// unanimously, to cut Erik Madsen. Number 8.
//
// Driven by resentment, Erik went looking for power. He found a dark entity
// known as The Schnitz, and traded his soul for it. Moments before tip-off he
// struck: he stripped every Stew Leonard of their basketball talent and
// unleashed a horde of the undead on the gym and the campus around it.
//
// Now he's sealed in the metal-clad Press Box above center court with the
// school's PA system, his dogs and a grudge, taunting his old team between
// rounds. Trapped inside, the team has to fight through the horde, follow his
// voice, take back what he stole and drag him out of that booth.
//
// Pure data: read by the sim (which line to say, when) and by the UI.
// =============================================================================

// --- Erik over the PA ----------------------------------------------------------
// Each category is a list; the PA picks lines it hasn't used yet.
export const PA_LINES = {
  intro: [
    "Testing. Testing. Welcome to the championship game, Stew Leonards. Tonight's starting lineup... is dead.",
    "Attention, Stew Leonard High. Your undefeated team has taken the floor. Please give them a warm welcome. With your teeth.",
  ],
  round: [
    "Next quarter! Same as the last one. You lose.",
    "Remember the vote, boys? Unanimous. Well. So is this.",
    "Feeling slow? Heavy? That's what it's like without talent. Welcome to the bench.",
    "Box out! Box out! Oh, you can't. I took that too.",
    "Number eight never missed a practice. Number eight never missed a free throw. Number eight got cut.",
    "Coach always said defense wins championships. Let's see some defense.",
    "The crowd came to see a game. They stayed to see dinner.",
    "Full-court press! That's the whole student body, by the way.",
    "You voted me off a team. I voted you off the planet.",
    "Whoever keeps boarding up the windows: that's a technical foul.",
    "Undefeated season. Undefeated. Hold on to that. It's all you've got left.",
    "Run the play, boys. Oh right. You don't remember the plays. I do.",
  ],
  milestone: {
    5: "Round five. That's further than you got without me in the playoffs last year.",
    10: "Ten rounds? Huh. The Schnitz said six. Don't let it go to your heads.",
    15: "Fifteen. Okay. Okay. Overtime. I can do overtime.",
    20: "Twenty rounds. Do you people not have homework?",
    25: "Fine. I'm impressed. I hate that I'm impressed. I'd have played you more minutes.",
    30: "Thirty. The Schnitz is getting impatient. So am I.",
  },
  roundEnd: [
    "Timeout! Hydrate. Stretch. Think about who you cut.",
    "Halftime. The band's dead, so I'll just talk.",
    "Nobody leave. The doors are chained. The season isn't over.",
  ],
  cheddar: [
    "Gouda! Brie! Havarti! Dinner time! ...Not you, Stew Leonards. You ARE dinner.",
    "Have you met my dogs? The Schnitz threw them in. Signing bonus.",
    "Release the Cheddars!",
  ],
  cheddarEnd: [
    "My babies! You'll pay for that. In blood. Or points. Blood.",
    "You know how long it took to house-train hellhounds? Two days. But still!",
  ],
  power: [
    "Hey! Who threw the breakers? I liked it dark. The Schnitz likes it dark.",
    "Great. Now the whole school can watch you lose.",
  ],
  boxMoved: [
    "Ha! My bobblehead! Number eight! The only one of me they ever made.",
    "The box is MY box. It goes where I say it goes.",
    "Aw. Did your little box run away? Like your free throw percentage.",
  ],
  madDog: [
    "Feeding the Mad Dog? That crate is booster club property! You can't just... okay, you can.",
    "Go Mad Dogs. I mean that sarcastically.",
  ],
  down: [
    "Down goes a Stew Leonard! Somebody blow the whistle!",
    "Is that it? I've seen more hustle from the water boy. Actually the water boy's out there now. Say hi.",
    "Oh no. Oh no! Anyway.",
  ],
  revived: [
    "Of course you got back up. You always did love a comeback story.",
    "Back in the game? Fine. Sub him in.",
  ],
  pressureCooker: [
    "Hey! That was my front row!",
    "Do you know how hard it is to fill a gym for a championship?",
  ],
  idle: [
    "I can hear you, you know. Every speaker in the school is mine.",
    "Look up, boys. I've got the best seat in the house.",
    "The Schnitz says hi. The Schnitz doesn't really say hi. The Schnitz just... watches.",
    "Fun fact: the bleachers hold four hundred. They used to, anyway.",
    "This message is brought to you by the Stew Leonard High booster club. Which is me now.",
    "I kept my jersey, you know. Number eight. Still fits.",
    "The cows in the cafeteria are singing again. Don't go in there. Or do.",
    "Somebody left the trophy case open. Oh wait, that was me. It's in pieces now. Like your season.",
  ],
  song: [
    "No. No no no. Who found that tape? Turn it OFF. That was the WARM-UP tape. I was never allowed to pick a song!",
  ],
  songEnd: [
    "...Okay. That's still catchy. I hate that it's catchy.",
  ],
  gameOver: [
    "And that's the buzzer! Final score: Erik, everything. Stew Leonards, nothing.",
    "Game over. Season over. Team... well. Look at you.",
    "That's the final whistle. Good game. No it wasn't.",
  ],

  // --- the main quest, "The Final Whistle" -----------------------------------
  breaker: [
    "One breaker? Cute. There are two, genius.",
  ],
  breakersDone: [
    "Fine. Lights on. It won't help you find the trophy. I broke it into pieces. Beautiful pieces.",
  ],
  trophyPiece: [
    "Put that down. That's a championship trophy. You haven't WON it.",
    "Collecting the pieces? Gluing the season back together? Sweet. Pointless, but sweet.",
  ],
  trophyPlaced: [
    "No. Not the crate. Not under the floor. Who told you about the crate?",
  ],
  statueFed: [
    "Stop feeding my statue! That's... that's not how... okay, that is how it works.",
  ],
  coin: [
    "Give that back. That's The Schnitz's coin. You have no idea what it's worth. It cost me EVERYTHING.",
  ],
  cladding: [
    "Hey! Close that! Close it! Stop LOOKING at me!",
    "Fine. Look. Get a good look. This is what winning looks like.",
  ],
  ritualStart: [
    "Those balls are mine now. You want your talent back? Stand in the circle. See how long you last.",
  ],
  ritualDone: [
    "That was mine! I EARNED that! The Schnitz gave that to ME!",
    "Enjoy it while it lasts. It won't.",
  ],
  bossStart: [
    "You want me? Come get me. Defenders, take the floor. Run the playbook.",
  ],
  bossPhase2: [
    "What are you doing with my speakers? Those are NOT regulation!",
  ],
  bossEnd: [
    "No! No no no! The glass! The SCHNITZ PAID FOR THAT GLASS!",
  ],
};

// The Schnitz itself. It speaks when you first lift the Chopper (the lights
// go down and its eyes open over the stew), and once more at the very end.
// at: seconds into the dark.
export const SCHNITZ_LINES = {
  ending: 'This season isn\'t over yet.',
  chopper: [
    { at: 2.6, text: 'You got your powers back. But you are still powerless against The Schnitz.' },
    { at: 8.2, text: 'That little toy was put together in my house. Over my stew.' },
    { at: 12.6, text: 'My children walk among the dead now. Fifty of them. Put them down... and we will see.' },
  ],
};

// --- Talking back on the intercom (teachers' lounge) ---------------------------
// Stew presses the button on the PA handset and says something; Erik answers.
export const INTERCOM = [
  { stew: "Erik. Is that you? It's us.", erik: "I know it's you. I'd know that sorry excuse for a pick-and-roll anywhere." },
  { stew: "What did you do to us?", erik: "I took it back. The speed, the hops, the jumper, the D. Everything that made you the Stew Leonards. It's mine now." },
  { stew: "This is about getting cut, isn't it?", erik: "Unanimous. UNANIMOUS. Not one of you stood up. Not one." },
  { stew: "It wasn't personal, Erik.", erik: "It was the championship, and it was personal." },
  { stew: "Who is The Schnitz?", erik: "Somebody who actually picked me. That's all you need to know." },
  { stew: "Where are you even hiding?", erik: "Look up. Center court. The Press Box. I've got the best seat in the house." },
  { stew: "You could still call this off, you know.", erik: "Call it off? Tip-off was hours ago. You don't call off a championship." },
  { stew: "We're getting out of here, Erik.", erik: "Sure. Right after you fix the power, rebuild the trophy, and find a way through solid steel. Take your time. I've got forever. Literally. That was the deal." },
];
export const INTERCOM_REPEAT = [
  "Stop pressing the button.",
  "This line is for emergencies.",
  "Timeout's over. Get back out there.",
  "Leave a message after the buzzer.",
];

// --- Lore notes scattered around the school -------------------------------------
export const NOTES = [
  {
    id: 'flyer', title: 'Championship program', where: 'Gymnasium',
    text: "STEW LEONARD HIGH · STATE CHAMPIONSHIP\nTonight! Tip-off 7 PM in the Gymnasium.\nYour undefeated STEW LEONARDS go for the title!\n\nStarting lineup inside.\n\n(The roster page has a name blacked out with marker. You can still read the number: 8.)",
  },
  {
    id: 'detention', title: "Coach's memo", where: 'Front office',
    text: "TO: Athletic Director\nRE: Varsity roster change\n\nEffective immediately, #8 Erik Madsen is released from the varsity basketball roster. The team vote was unanimous.\n\nI've told Erik he's welcome to keep stats from the Press Box.\n\nHe took it well. He said \"see you at tip-off.\"",
  },
  {
    id: 'labnotes', title: "Erik's notebook", where: 'Science lab',
    text: "How to get picked:\n1. Be better. (Tried. Didn't work.)\n2. Ask nicely. (Tried. Got laughed at.)\n3. Ask someone else.\n\nThe library book says it answers at midnight, at the center of a place where people compete. Circle. Candles. Something you love.\n\nI love basketball. So, the jersey.\n\nIt answered. It said its name is The Schnitz. It said it picks me.",
  },
  {
    id: 'recipe', title: 'Concession stand log', where: 'Kitchen',
    text: "CONCESSIONS — CHAMPIONSHIP NIGHT\n\n6:40 PM — Hot dogs on. Pretzels in the warmer.\n6:52 PM — The dairy cow animatronic out front started singing by itself. It's not plugged in.\n6:55 PM — Every carton of milk went sour at once.\n6:58 PM — Lights flickered. Somebody in the crowd started screaming. Then everyone.\n\n(The rest of the page is smeared.)",
  },
  {
    id: 'boiler', title: 'Maintenance log', where: 'Boiler room',
    text: "6:30 PM — Former player (Madsen, #8) asked where the main breakers are. Told him: one in the cafeteria, one in the science lab. Both have to be thrown to bring the campus back.\n6:41 PM — Both breakers off. Mr. Madsen says it's \"for ambience.\"\n6:59 PM — Strange noises from the gym. Going to check.\n\n(No more entries.)",
  },
  {
    id: 'library', title: 'Overdue notice', where: 'Library',
    text: "OVERDUE NOTICE\nBorrower: Erik Madsen\nTitle: Bargains With the Other Side: A Beginner's Guide\nDue: the night of the championship\nFine: your soul (librarian's joke, presumably)\n\nThe margins are full of diagrams. They look like basketball plays.",
  },
  {
    id: 'maddog', title: 'Booster club plaque', where: 'Auditorium',
    text: "THE MAD DOG MACHINE\nProperty of the Stew Leonard High Booster Club.\n\"Feed the dog, unleash the dog.\"\n\nTaped underneath: For the championship pep rally the crate has been moved under the gym floor, center court. The trophy base works the lift. Put the trophy back together and it'll come up. 5000 points to feed it. — Booster Club",
  },
  {
    id: 'contract', title: 'The Bargain', where: "Teachers' lounge",
    text: "I, Erik Madsen, #8, do hereby give my soul, in full and forever, to THE SCHNITZ.\n\nIn exchange: their talent. All of it. Speed. Jump. Power. Defense. Every one of the Stew Leonards, at tip-off.\n\nAnd a crowd. A big one. Hungry.\n\nSigned in something that isn't ink.\n\n(A coin is drawn in the corner. Underneath, in different handwriting, very small: \"The mascot keeps the coin. Feed it.\")",
  },
];

// --- The Stew song Easter egg: find all three ------------------------------------
// Erik confiscated the team's three good-luck charms the night he was cut.
export const STEW_ITEMS = [
  { id: 'ladle', name: 'Lucky Ladle', where: 'Kitchen', text: 'The team\'s lucky ladle. Every Stew Leonard tapped it on the rim before tip-off. Undefeated.' },
  { id: 'tape', name: 'STEW JAMS warm-up tape', where: 'Band room', text: 'The warm-up mixtape, STEW JAMS, in four different handwritings. A sticky note: "CONFISCATED — #8".' },
  { id: 'can', name: 'Can of Stew', where: 'Locker rooms', text: 'A dented can of stew taped inside a locker with STEW scratched into the door. Team tradition. Expiry date: never.' },
];

// Lyrics for the song (shown as subtitles), in beats from the start.
export const SONG_LYRICS = [
  { at: 32, text: 'Undefeated and the gym is loud' },
  { at: 40, text: 'Stew Leonards running through the crowd' },
  { at: 48, text: 'Erik in the Press Box, Erik on the phone' },
  { at: 56, text: "Erik, buddy, leave us alone!" },
  { at: 64, text: 'WE GO STEW! (STEW!)' },
  { at: 72, text: 'WE GO STEW! (STEW!)' },
  { at: 80, text: 'Five on the floor and never alone' },
  { at: 88, text: 'WE GO STEW!' },
  { at: 96, text: 'Tap the ladle, lace them tight' },
  { at: 104, text: 'Championship game is tonight' },
  { at: 112, text: "Now the whole crowd's walking but we don't care" },
  { at: 120, text: 'Nothing but net, nothing but air!' },
  { at: 128, text: 'WE GO STEW! (STEW!)' },
  { at: 136, text: 'WE GO STEW! (STEW!)' },
  { at: 144, text: 'Five on the floor and never alone' },
  { at: 152, text: 'WE GO STEW!' },
  { at: 176, text: 'One more time!' },
  { at: 184, text: 'WE GO STEW! (STEW!)' },
  { at: 192, text: 'WE GO STEW! (STEW!)' },
  { at: 200, text: 'Final buzzer and we go home' },
  { at: 208, text: 'WE GO STEW!' },
];
export const SONG_BPM = 152;
export const SONG_BEATS = 220;

// Speech placeholder timing: how long a line takes to "say".
export const lineDuration = (text) => Math.min(9, 1.2 + text.length * 0.055);
