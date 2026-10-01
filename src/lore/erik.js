// =============================================================================
// LORE — Erik Madsen and Team Stew.
//
// Last Bell High's ten-year reunion. Erik Madsen, former class president and
// self-appointed hall monitor, organised it. He never forgave the four of them
// they all called "Stew" for the Great Stew Incident of senior year (the
// cafeteria, the fire alarm, the goat). So for the reunion he cooked a stew of
// his own, with a little something from the science lab in it. Four hundred
// guests ate it. Stew showed up late.
//
// Now he's locked in the principal's office with the PA system, his dogs and
// a grudge, and every speaker in the school is his.
//
// Pure data: read by the sim (which line to say, when) and by the UI.
// =============================================================================

// --- Erik over the PA ----------------------------------------------------------
// Each category is a list; the PA picks lines it hasn't used yet.
export const PA_LINES = {
  intro: [
    "Testing. Testing. Oh good, it works. Welcome back to Last Bell High, Stew. Did you bring a dish? No? Typical.",
    "Attention, Last Bell High. The Stew have arrived. Late. Everyone else has already eaten. Please make them feel... welcome.",
  ],
  round: [
    "Another round! Just like old times. Except this time, the hall monitor wins.",
    "You know what I remember about you, Stew? Nothing good. Absolutely nothing good.",
    "Please keep the hallways clear. Of yourselves.",
    "Reminder: there is no running in the halls. Unless something is chasing you. Which it is.",
    "I wrote you all a yearbook message. It just says 'see you soon.' Isn't that sweet?",
    "Ten years. Ten years of planning. And you still showed up late.",
    "Fun fact: the reunion committee was me. The guest list was me. The menu was me.",
    "Nice of you to finally show up to something, Stew.",
    "The class of '16 sends its regards. Mostly by trying to eat you.",
    "Remember Mr. Halvorsen? He's in the cafeteria. Say hi. Don't let him get close.",
    "I'm told the stew was delicious. Four hundred people can't be wrong.",
    "Whoever keeps boarding up the windows: those are school property. I'm writing you up.",
  ],
  milestone: {
    5: "Round five. That's further than you ever got in chemistry.",
    10: "Round ten? Huh. I had money on six. Don't let it go to your heads.",
    15: "Fifteen. Okay. Okay. This is fine. I have more guests.",
    20: "Twenty rounds. Do you people not have jobs?",
    25: "You know what, Stew? Fine. I'm impressed. I hate that I'm impressed.",
    30: "Thirty. I'm going to need a bigger reunion.",
  },
  roundEnd: [
    "Intermission! Hydrate. Stretch. Reflect on your choices.",
    "Take a breather. They're just warming up the second course.",
    "Nobody leave. Seriously. The doors are chained. I checked.",
  ],
  cheddar: [
    "Gouda! Brie! Havarti! Dinner time! ...Not you, Stew. You ARE dinner.",
    "Oh, have you met my dogs? They've been on a strict diet. Of you, starting now.",
    "Release the Cheddars!",
  ],
  cheddarEnd: [
    "My babies! You'll pay for that. I'll make sure of it. Possibly by mail.",
    "You know how long it took to train those dogs? Two days. But still!",
  ],
  power: [
    "Hey! Who turned the power back on? That was AMBIENCE.",
    "Great. Now everybody can see how bad your aim is.",
  ],
  boxMoved: [
    "Ha! That's my campaign bobblehead! Vote Madsen! Oh wait, you didn't. Nobody did.",
    "The box is MY box. It goes where I say it goes.",
    "Aw. Did your little box run away? So did your prom dates.",
  ],
  madDog: [
    "Feeding the Mad Dog? That machine is booster club property! You can't just... okay, you can.",
    "Go Mad Dogs. I mean that sarcastically.",
  ],
  down: [
    "Down goes Stew! Somebody ring the bell!",
    "Is that it? Is that all? I've seen better effort in gym class. Yours, actually.",
    "Oh no. Oh no! Anyway.",
  ],
  revived: [
    "Of course you got back up. Cockroaches always do.",
    "Seconds? You want SECONDS? Fine.",
  ],
  pressureCooker: [
    "Hey! Those were my guests!",
    "Do you know how hard it is to get people to RSVP?",
  ],
  idle: [
    "I can hear you, you know. Every speaker in the school is mine.",
    "Did you know the cafeteria still has pudding? Not for you.",
    "Hall pass, please. Anyone? No? Detention for everyone.",
    "This message is brought to you by the reunion committee. Which is me.",
    "If found, Stew should be returned to the cafeteria. Ideally in a bowl.",
    "Somebody left the science lab unlocked. Oh wait, that was me. On purpose.",
    "Fun fact: the auditorium seats four hundred. It used to, anyway.",
  ],
  song: [
    "No. No no no. Who found that tape? Turn it OFF. I confiscated that in 2015!",
  ],
  songEnd: [
    "...Okay. That's still catchy. I hate that it's catchy.",
  ],
  gameOver: [
    "And that's the bell! Class dismissed. Permanently.",
    "Stew. Finally served. Ha. Ha. I've been saving that one for ten years.",
    "Well, that's the end of the reunion. Same time in ten years? Oh. Right.",
  ],
};

// --- Talking back on the intercom (principal's office) -------------------------
// Stew presses the button on the PA mic and says something; Erik answers.
export const INTERCOM = [
  { stew: "Erik. Is that you? It's us.", erik: "I know it's you. Nobody else would show up to a reunion an hour late and covered in zombie." },
  { stew: "What did you put in the stew?", erik: "Love. And Batch Seven. Mostly Batch Seven." },
  { stew: "This is about the Great Stew Incident, isn't it?", erik: "The fire alarm. The goat. My PRESIDENTIAL ADDRESS. Of course it's about the Great Stew Incident!" },
  { stew: "The goat was not our idea.", erik: "The goat was wearing my sash, Stew." },
  { stew: "You could just turn this all off, you know.", erik: "Off? I just got it ON. Do you know how long it took to reprogram a lunch lady?" },
  { stew: "Where are you even hiding?", erik: "I'm in the principal's office. Which you'd know, if you'd ever been sent here. Wait. You were always sent here." },
  { stew: "Does anyone else know you're doing this?", erik: "The dogs know. The dogs are very supportive." },
  { stew: "We're going to get out of here, Erik.", erik: "Oh, I'm sure. Right after you find that stupid mixtape. And that ladle. And that can. Which you won't. Because I hid them. Very well." },
];
export const INTERCOM_REPEAT = [
  "Stop pressing the button.",
  "This line is for emergencies.",
  "I'm busy. Try again never.",
  "Leave a message after the zombie.",
];

// --- Lore notes scattered around the school -------------------------------------
export const NOTES = [
  {
    id: 'flyer', title: 'Reunion flyer', where: 'Basketball court',
    text: "LAST BELL HIGH · 10-YEAR REUNION\nTonight! Gym, 7 PM.\nDinner served in the cafeteria: Chef's Special Stew.\n\nOrganised by your class president, Erik Madsen.\n\n(Handwritten across the bottom:) Stew NOT invited. — E.M.",
  },
  {
    id: 'detention', title: 'Detention slip', where: 'Front office',
    text: "DETENTION SLIP — Last Bell High\nStudents: \"Stew\" (all four)\nOffense: The Great Stew Incident. Pulled the fire alarm during the class president's address. Released a goat into the cafeteria. The goat was wearing the class president's sash.\nReported by: E. Madsen, Hall Monitor\nTeacher's note: Erik, you can't give detention. You're a student.",
  },
  {
    id: 'labnotes', title: "Erik's lab notebook", where: 'Science lab',
    text: "Batch 5: frog twitches. Promising.\nBatch 6: frog sits up. Frog looks at me. I look at frog.\nBatch 7: frog gets up. Second frog gets up. Mr. Halvorsen gets up, which is a problem, because he was only asleep.\n\nBatch 7 it is.\n\nMust not let Stew anywhere near the cafeteria. They ruin everything.",
  },
  {
    id: 'recipe', title: 'Recipe card', where: 'Kitchen',
    text: "REUNION STEW — serves 400\n\n12 lbs potatoes\n9 lbs carrots\n1 jar Batch 7 (the whole jar)\nSalt to taste\n\nServe hot. Serve to everyone.\nKeep four bowls warm for the late arrivals. Extra Batch 7 in theirs.",
  },
  {
    id: 'boiler', title: 'Maintenance log', where: 'Boiler room',
    text: "7:38 PM — Mr. Madsen asked for the master key to 'check the thermostat.'\n7:42 PM — Main power cut to the whole building. Mr. Madsen says it is 'for ambience.'\n7:51 PM — Strange noises from the cafeteria. Going to check.\n\n(No more entries.)",
  },
  {
    id: 'library', title: 'Overdue notice', where: 'Library',
    text: "OVERDUE NOTICE\nBorrower: Erik Madsen\nTitle: How to Win Friends and Influence People\nDue: ten years ago\nFine: $412.50\n\nThe margins are full of notes. Most of them say \"STEW\" with a line through it.",
  },
  {
    id: 'maddog', title: 'Booster club plaque', where: 'Auditorium',
    text: "THE MAD DOG MACHINE\nProperty of the Last Bell Mad Dogs Booster Club.\n\"Feed the dog, unleash the dog.\"\n\nTaped underneath, in Erik's handwriting: They'll never figure out how to use it. Insert weapon. 5000 points. Do NOT tell Stew.",
  },
];

// --- The Stew song Easter egg: find all three ------------------------------------
export const STEW_ITEMS = [
  { id: 'ladle', name: 'Stew Ladle', where: 'Kitchen', text: 'The ladle from the Great Stew Incident. Still sticky.' },
  { id: 'tape', name: 'STEW JAMS mixtape', where: 'Band room', text: 'A cassette labelled STEW JAMS in four different handwritings. "CONFISCATED — E.M." on a sticky note.' },
  { id: 'can', name: 'Can of Stew', where: 'Locker rooms', text: 'A dented can of stew in a locker with STEW scratched into the door. Expiry date: never.' },
];

// Lyrics for the song (shown as subtitles), in beats from the start.
export const SONG_LYRICS = [
  { at: 32, text: 'Ten years gone and the bell still rings' },
  { at: 40, text: 'Same old halls, same old things' },
  { at: 48, text: 'Erik on the speakers, Erik on the phone' },
  { at: 56, text: "Erik, buddy, leave us alone!" },
  { at: 64, text: 'WE GO STEW! (STEW!)' },
  { at: 72, text: 'WE GO STEW! (STEW!)' },
  { at: 80, text: 'Four in the hallway, never alone' },
  { at: 88, text: 'WE GO STEW!' },
  { at: 96, text: 'Goat in the cafeteria, fire bell loud' },
  { at: 104, text: 'Sash on the goat and the goat looked proud' },
  { at: 112, text: "Now the whole school's walking but we don't care" },
  { at: 120, text: 'Bring a ladle, bring a chair!' },
  { at: 128, text: 'WE GO STEW! (STEW!)' },
  { at: 136, text: 'WE GO STEW! (STEW!)' },
  { at: 144, text: 'Four in the hallway, never alone' },
  { at: 152, text: 'WE GO STEW!' },
  { at: 176, text: 'One more time!' },
  { at: 184, text: 'WE GO STEW! (STEW!)' },
  { at: 192, text: 'WE GO STEW! (STEW!)' },
  { at: 200, text: 'Last bell rings and we go home' },
  { at: 208, text: 'WE GO STEW!' },
];
export const SONG_BPM = 152;
export const SONG_BEATS = 220;

// Speech placeholder timing: how long a line takes to "say".
export const lineDuration = (text) => Math.min(9, 1.2 + text.length * 0.055);
