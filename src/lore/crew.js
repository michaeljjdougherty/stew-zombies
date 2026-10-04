// =============================================================================
// LORE — the crew: who they are and what they say.
//
// Playable at launch: Kearns, Ryan, Pit and Rocco. Brian unlocks once you've
// finished The Final Whistle (he's the one who comes through the portal).
//
// In a game, whoever you play talks out loud. The rest of the crew are trapped
// somewhere else in Stew Leonard High and chime in over walkie-talkies, and
// Erik cuts in on the PA. Pure data: read by src/sim/crew.js and the UI.
// =============================================================================

export const CREW = {
  kearns: {
    name: 'Kearns',
    nick: ['Kearns', 'tomato foot', 'carrot farmer', 'Kearns ugly'],
    // babble voice (see audio/sfx.js): pitch, grit, speed
    voice: { f0: 128, grit: 0.32, rate: 1 },
    bio: 'Has the worst luck in the building. Loves his iPad mini. His sister Kearnita would know what to do.',
  },
  ryan: {
    name: 'Ryan',
    nick: ['Ryan', 'Mad Dog', 'strong man'],
    voice: { f0: 98, grit: 0.45, rate: 0.95 },
    bio: 'Mr. Strong Man. The original Mad Dog. Wants to make it home to Maisy dog. Still wants his iPad mini back.',
  },
  pit: {
    name: 'Pit',
    nick: ['Pit', 'Pitty'],
    voice: { f0: 112, grit: 0.25, rate: 0.72 },
    bio: 'Used to rap. Got suspended for a diss track. Left for a while. Sometimes acts like a horse.',
  },
  rocco: {
    name: 'Rocco',
    nick: ['Rocco', 'Lumpy'],
    voice: { f0: 150, grit: 0.3, rate: 1.12 },
    bio: 'Such a little rascal. "Well well well." Would rather be playing 2K. Everyone tells him to shut up.',
  },
  brian: {
    name: 'Brian',
    nick: ['Brian', 'B'],
    voice: { f0: 104, grit: 0.4, rate: 0.9 },
    bio: 'Brian Luke. Came through a portal. Does not panic. Does not miss.',
  },
};

// The four on the walkie-talkies (whoever you're not playing).
export const LAUNCH_CREW = ['kearns', 'ryan', 'pit', 'rocco'];

// ---------------------------------------------------------------------------
// Reactions: what your character says out loud. Category -> character -> lines.
// ---------------------------------------------------------------------------
export const REACT = {
  roundStart: {
    kearns: ["Okay. Okay. My luck's gotta turn eventually.", "Here they come. Of course they're coming at me.", "Kearnita would've been out of here by now."],
    ryan: ["Let's go. Mad Dog's hungry.", "Maisy dog, daddy's coming home. After this.", "Line 'em up."],
    pit: ["Yeeeah. More of 'em. Cool. Cooool.", "Round again, man? Didn't we just... yeah okay.", "(whinnies) ...sorry. Habit."],
    rocco: ["Well well well. Look who's back.", "This is like 2K on legend difficulty. I love it.", "Bring it, ugly. Not you, Kearns. Them."],
    brian: ["Next.", "Stay behind me.", "Good. I was getting bored."],
  },
  multiKill: {
    kearns: ["Did that just... go RIGHT for me?", "Somebody write that down. Kearns, good luck, one time.", "That's for the iPad, you freaks."],
    ryan: ["Strong man! STRONG MAN!", "That's what a Mad Dog does.", "Lift with your legs, boys."],
    pit: ["Ohhh that was clean. That was so clean, man.", "Pit with the triple. Pit with the... yeah.", "Bars. That was bars."],
    rocco: ["Well well WELL!", "That's a highlight. Put it on the 2K cover.", "Did everybody see that? Nobody saw that."],
    brian: ["Clean.", "Too easy.", "Next."],
  },
  knife: {
    kearns: ["Up close and personal. Gross.", "I'm gonna need to wash this hand. Twice."],
    ryan: ["Hands on. Just how I like it.", "That's a Mad Dog bite."],
    pit: ["Stabby stab, mannn.", "Got him. Got him good. I think."],
    rocco: ["Shank city, baby.", "Little guy, big knife."],
    brian: ["Quiet way.", "No ammo needed."],
  },
  down: {
    kearns: ["Of course. OF COURSE it's me.", "Tell Kearnita... she can have my iPad mini.", "This is Ryan's fault somehow."],
    ryan: ["I'm down! Somebody get the strong man up!", "Can't... go out... like this. Maisy needs me.", "Ugh. That one hurt."],
    pit: ["Woah. Floor's comfy. Floor's real comfy.", "Man down. Pit down. Same thing.", "Neighhh... no. No, I'm hurt."],
    rocco: ["Lumpy's down! I mean Rocco! Rocco's down!", "This is so not fair.", "Somebody pick me up, I'm small, I'm light!"],
    brian: ["Just a scratch. Get me up.", "Not like this."],
  },
  revived: {
    kearns: ["Back up. Still unlucky. But up.", "Thanks. Don't tell Ryan."],
    ryan: ["Strong man's back.", "Can't keep a Mad Dog down."],
    pit: ["I'm up. I'm up, man. I'm... up.", "Thanks, bro. Love you, bro."],
    rocco: ["Well well well. Look who's alive.", "Respawned. Like 2K."],
    brian: ["Appreciated.", "Back in."],
  },
  dryFire: {
    kearns: ["Out of ammo. Naturally.", "Click. CLICK. Why is it always me?"],
    ryan: ["Empty! Gotta reload or punch something.", "Out! Who's got a mag?"],
    pit: ["Gun's... empty? Gun's empty.", "Ran out of bars, man."],
    rocco: ["Click click click. That's not good.", "Out! Out out out!"],
    brian: ["Empty.", "Switching."],
  },
  hurt: {
    kearns: ["They always go for me!", "Ow! My tomato foot!"],
    ryan: ["Hit me harder, see what happens!", "That's gonna leave a mark."],
    pit: ["Ow, man. Not cool.", "Ouch. Ouch ouch."],
    rocco: ["Hey! Pick on someone your own size!", "Ow! Lumpy got hit!"],
    brian: ["Getting close.", "Back off."],
  },
  boxGood: {
    kearns: ["No way. Something went right for me.", "I'm keeping this. Forever. Like my iPad."],
    ryan: ["Now THAT'S a weapon.", "Strong gun for a strong man."],
    pit: ["Ohhh, shiny. Shiny shiny.", "This one's got bars, man."],
    rocco: ["Well well well. Look what Lumpy pulled.", "Legendary pull. Like a 2K pack."],
    brian: ["This'll do.", "Nice."],
  },
  boxBad: {
    kearns: ["Typical. The box hates me. Everything hates me.", "Erik's bobblehead. Of course I got Erik's bobblehead."],
    ryan: ["Box ran away. Smart box.", "Come back here, box!"],
    pit: ["Where'd the box go, man? Box? Boxxx?", "Box ghosted me. Like I ghosted everybody."],
    rocco: ["Rigged. Totally rigged.", "That's what happens in 2K too. Rigged."],
    brian: ["Fine. We'll find it."],
  },
  perk: {
    kearns: ["Tastes like soup. Somehow that's on brand.", "Feeling lucky. Which is new."],
    ryan: ["Mmm. Protein.", "Now we're cooking."],
    pit: ["Glug glug glug. Ahhh.", "Tastes like the old days, man."],
    rocco: ["Spicy! Lumpy likes it spicy.", "Well well well. That's the good stuff."],
    brian: ["Better.", "Ready."],
  },
  upgrade: {
    kearns: ["It upgraded. It actually worked. For me!", "Look at this thing. Kearnita's gonna be so jealous."],
    ryan: ["That's MY machine. And that's MY upgrade.", "The Mad Dog made it mean. Like me."],
    pit: ["Doggy made it fancy, man.", "Ohhh she's pretty now."],
    rocco: ["Well well well. That's a cheat code.", "Ninety-nine overall. This gun's a ninety-nine."],
    brian: ["Better.", "That's more like it."],
  },
  cheddar: {
    kearns: ["Dogs. It had to be dogs.", "Why do they always smell like cheese?"],
    ryan: ["Here, doggy doggy. Mad Dog wants to play.", "No offense to Maisy, but these ones gotta go."],
    pit: ["Puppies? Ohhh no. Bad puppies.", "Those aren't horses, man."],
    rocco: ["Well well well. Cheese dogs.", "Sit! ...nope, they don't sit."],
    brian: ["Dogs. Aim low.", "Watch the corners."],
  },
};

// Chance (0..1) that a reaction is said at all, so they don't chatter nonstop.
export const REACT_CHANCE = {
  roundStart: 0.4, multiKill: 0.6, knife: 0.25, down: 0.9, revived: 0.7, dryFire: 0.6, hurt: 0.25,
  boxGood: 0.9, boxBad: 0.9, perk: 0.5, upgrade: 0.9, cheddar: 0.9,
};

// Someone on the walkie answering. Category -> list of { who, to?, text }.
// `to` = only when that character is the one who spoke.
export const RADIO = {
  down: [
    { who: 'ryan', to: 'kearns', text: "Get up, tomato foot! I'm not carrying you!" },
    { who: 'rocco', to: 'kearns', text: "Kearns ugly went down. Classic." },
    { who: 'pit', to: 'kearns', text: "Kearns is down? Again? Mannn." },
    { who: 'kearns', to: 'ryan', text: "Mr. Strong Man's down? Ha! ...wait, no, get up, we need you." },
    { who: 'rocco', to: 'ryan', text: "Well well well. The Mad Dog got put down." },
    { who: 'kearns', to: 'rocco', text: "Lumpy's down! Somebody... eventually... help him." },
    { who: 'ryan', to: 'rocco', text: "Shut up and get up, Lumpy." },
    { who: 'rocco', to: 'pit', text: "Pit's horsin' around on the floor again." },
    { who: 'kearns', to: 'pit', text: "Pit, you can't sleep there!" },
    { who: 'ryan', to: 'brian', text: "Brian's down?! Okay. Now I'm worried." },
  ],
  multiKill: [
    { who: 'rocco', text: "Was that you? Whoever that was, well well well." },
    { who: 'ryan', to: 'kearns', text: "Kearns did that? Somebody check if he's okay." },
    { who: 'kearns', to: 'ryan', text: "Yeah yeah, strong man. Still owe me an iPad mini." },
    { who: 'pit', text: "Heard that from here, man. That was loud. That was bars." },
  ],
  boxBad: [
    { who: 'ryan', to: 'kearns', text: "The box ran from Kearns. Even the box knows." },
    { who: 'rocco', to: 'kearns', text: "Worst luck in the building. Carrot farmer strikes again." },
    { who: 'kearns', text: "It moved? That's usually my thing." },
  ],
  boxGood: [
    { who: 'rocco', text: "What'd you get? Gimme. I'll trade you my 2K account." },
    { who: 'kearns', to: 'ryan', text: "Ryan got the good gun. Of course Ryan got the good gun." },
    { who: 'ryan', to: 'kearns', text: "Kearns got something good? Write down the date." },
  ],
  upgrade: [
    { who: 'ryan', text: "You're using MY machine. Be gentle with her." },
    { who: 'rocco', to: 'ryan', text: "Ryan's petting the machine again." },
  ],
  roundStart: [
    { who: 'rocco', text: "Well well well. Round's starting, ladies." },
    { who: 'ryan', text: "Everybody check in. Maisy's counting on me." },
    { who: 'pit', text: "(slow) ...is it a new round? It feels like a new round." },
    { who: 'kearns', text: "Is anybody else's walkie sticky? Mine's sticky." },
  ],
};
export const RADIO_CHANCE = 0.4;

// ---------------------------------------------------------------------------
// Story conversations over the walkie-talkies, one for each beat of the game.
// { who, text } — `who` is a crew id or 'erik' (on the PA).
// Lines with onlyAs only play when you're that character; skipAs never do.
// ---------------------------------------------------------------------------
export const TALKS = {
  // the start of round 1: everyone checks in, and Pit's back
  intro: [
    { who: 'ryan', text: "Radio check. Ryan here. I'm in the locker room. Everybody sound off." },
    { who: 'rocco', text: "Well well well. Rocco. Cafeteria. The cow statues are singing. I hate it here." },
    { who: 'kearns', text: "Kearns. I'm fine. Something already bit my shoe." },
    { who: 'ryan', text: "Shut up, tomato foot. Who else is on this channel?" },
    { who: 'pit', text: "Heyyy... guys. It's Pit. ...Pit's here." },
    { who: 'rocco', text: "PIT?! Pit's back?!" },
    { who: 'kearns', text: "Where have you BEEN? You just left!" },
    { who: 'pit', text: "Yeah, man. I needed some... time. To like... find myself. Found myself in the gym." },
    { who: 'ryan', text: "Unbelievable. Welcome back. Don't do the horse thing." },
    { who: 'pit', text: "(whinnies softly)" },
    { who: 'brian', onlyAs: 'brian', text: "Brian. I'm in the gym. Don't ask how." },
    { who: 'ryan', onlyAs: 'brian', text: "Brian?! You're HERE? Okay. Okay, we might actually make it." },
    { who: 'erik', text: "Ah, the whole team. On walkie-talkies. How adorable. Let's see how many of you are still talking by halftime." },
  ],
  // (Erik's own welcome over the PA comes first; this follows it)
  // first breaker thrown
  power: [
    { who: 'kearns', text: "Lights are coming on. Something's going right. I don't trust it." },
    { who: 'ryan', text: "Good. Now I can see what I'm punching." },
    { who: 'rocco', text: "Can somebody turn the cow statues OFF? They're still singing." },
  ],
  // a trophy piece
  trophy: [
    { who: 'rocco', text: "Is that the championship trophy? In PIECES? We didn't even play yet!" },
    { who: 'pit', text: "Erik broke it, man. That's like... a diss track. But a trophy." },
    { who: 'kearns', text: "Speaking of. Weren't you suspended for a diss track, Pit?" },
    { who: 'pit', text: "That track went HARD, man. Principal didn't get it." },
  ],
  // the Mad Dog Machine comes up through the floor
  madDog: [
    { who: 'ryan', text: "Wait. Wait wait wait. That's MY machine. That's the MAD DOG. Who moved my machine?!" },
    { who: 'rocco', text: "Well well well. Somebody's crate got relocated." },
    { who: 'kearns', text: "It's a booster club crate, Ryan, not your machine." },
    { who: 'ryan', text: "I AM the Mad Dog, Kearns. Just like that iPad mini is technically still mine." },
    { who: 'kearns', text: "You GAVE me that iPad!" },
    { who: 'ryan', text: "I LENT you that iPad." },
    { who: 'erik', text: "The Mad Dog. How fitting. A dog that does tricks for points. Just like this team." },
  ],
  // the mascot statue wakes up and drops the coin
  coin: [
    { who: 'rocco', text: "The cow's eyes are glowing. Why are the cow's eyes glowing?" },
    { who: 'pit', text: "Cow's got a coin in its mouth, man. That's a rich cow." },
    { who: 'kearns', text: "Knowing my luck it's cursed." },
    { who: 'ryan', text: "It's literally a dark Schnitz coin, Kearns. It's definitely cursed." },
  ],
  // the cladding comes up and there's Erik
  cladding: [
    { who: 'kearns', text: "There he is. Erik. In the press box. Looking all smug." },
    { who: 'ryan', text: "Erik! You come down here and say that to my face!" },
    { who: 'erik', text: "Say what? I haven't said anything yet. Oh wait. Yes I have. Hours of it." },
    { who: 'rocco', text: "Shut up, Erik. Only I get to be annoying on this team." },
    { who: 'ryan', text: "Shut up, Lumpy." },
  ],
  // the first talent comes back
  ritual: [
    { who: 'ryan', text: "I can feel it. Something's coming back." },
    { who: 'pit', text: "My flow's back, man. I could drop a track right now." },
    { who: 'kearns', text: "Please don't drop a track right now." },
    { who: 'rocco', text: "Well well well. Lumpy's got his jumper back." },
  ],
  // the showdown starts
  boss: [
    { who: 'ryan', text: "This is it, boys. Championship game. For real this time." },
    { who: 'kearns', text: "If I go down, Kearnita gets the iPad. Not Ryan." },
    { who: 'pit', text: "Let's run it, man. Like old times. Before I... you know. Left." },
    { who: 'rocco', text: "Well well well. Final quarter. Let's cook this guy." },
    { who: 'erik', text: "Oh, a pep talk! Adorable. Defenders: take the floor." },
  ],
  // the first Cheddar Round
  cheddar: [
    { who: 'ryan', text: "Dogs?! He's got DOGS? Maisy would never." },
    { who: 'rocco', text: "These dogs smell like a cheese plate." },
    { who: 'pit', text: "I'm more of a horse guy, man." },
  ],
};

// Between rounds, now and then: the crew catching up on the walkies.
export const BANTER = [
  [
    { who: 'kearns', text: "Ryan, when we get out, I want it on the record. The iPad mini is mine." },
    { who: 'ryan', text: "You took it out of my bag, Kearns." },
    { who: 'kearns', text: "You SAID I could borrow it!" },
    { who: 'ryan', text: "Two years ago." },
  ],
  [
    { who: 'rocco', text: "You know what this is like? 2K. On legend. With no timeouts." },
    { who: 'ryan', text: "Nobody wants to hear about 2K, Lumpy." },
    { who: 'rocco', text: "Everybody wants to hear about 2K." },
    { who: 'kearns', text: "Shut up, Lumpy." },
  ],
  [
    { who: 'ryan', text: "Maisy dog's probably sitting by the door right now. Waiting." },
    { who: 'pit', text: "Maisy's a good girl, man." },
    { who: 'ryan', text: "The best girl. I'm making it home to her. Whatever it takes." },
  ],
  [
    { who: 'kearns', text: "Kearnita texted me. Last week. She said 'don't go to the championship, it's gonna be weird.'" },
    { who: 'rocco', text: "Your sister called it?" },
    { who: 'kearns', text: "She always calls it. She got ALL the luck in the family." },
  ],
  [
    { who: 'pit', text: "Yo. I been working on a verse. About Erik." },
    { who: 'ryan', text: "Pit, no. That's literally how you got suspended." },
    { who: 'pit', text: "(slowly) Number eight... couldn't make the team... sold his soul... to a guy named... Schnitz... man." },
    { who: 'erik', text: "I can HEAR you. That's not even a rhyme." },
  ],
  [
    { who: 'rocco', text: "Hey Kearns. Hey. Kearns. Hey." },
    { who: 'kearns', text: "What, Rocco." },
    { who: 'rocco', text: "Well well well." },
    { who: 'kearns', text: "I'm turning my walkie off." },
  ],
  [
    { who: 'kearns', text: "My foot got stepped on, I got bit, I tripped twice. Twice, Ryan." },
    { who: 'ryan', text: "That's 'cause you got tomato feet, Kearns." },
    { who: 'kearns', text: "That's not even a THING." },
    { who: 'rocco', text: "Carrot farmer's got tomato feet. Big garden over there." },
  ],
  [
    { who: 'pit', text: "Where'd I go, you ask? I was... around, man. Saw some horses. Thought about stuff." },
    { who: 'rocco', text: "Nobody asked." },
    { who: 'ryan', text: "I asked. I'm glad you're back, Pit." },
    { who: 'pit', text: "(soft neigh) ...thanks, man." },
  ],
];
export const BANTER_CHANCE = 0.45;   // at the end of a round (not the first)

// ---------------------------------------------------------------------------
// Erik roasting whoever you're playing (mixed in with his usual lines).
// ---------------------------------------------------------------------------
export const ERIK_ROASTS = {
  kearns: [
    "Kearns! Kearns ugly. Kearns tomato foot. Kearns carrot farmer. I could do this all night. I WILL do this all night.",
    "Kearns, buddy. With your luck, I didn't even need The Schnitz.",
    "How's the iPad mini, Kearns? Oh, that's right. Ryan wants it back.",
    "Say hi to Kearnita for me. Oh wait, she's smart. She didn't come.",
  ],
  ryan: [
    "Ryan. Mr. Strong Man. Not so strong without your little machine, are we?",
    "The Mad Dog. Ha. Who's the dog now? Sit. Stay. Die.",
    "Thinking about Maisy dog, Ryan? She's going to miss you. Probably.",
    "Still fighting over an iPad mini, Ryan? Grown man. Iconic.",
  ],
  pit: [
    "Pit! You're back! Just in time to leave again. Permanently.",
    "Drop a diss track about THIS, Pit.",
    "Is that a horse noise? On my PA? In my gym?",
    "Pit, you left once. You could do it again. Exits are... well. No. They're not.",
  ],
  rocco: [
    "Shut up, Lumpy.",
    "Well well well, Rocco. I've been waiting all season to say that back to you.",
    "Rocco, this isn't 2K. There's no restart button. Well. There is. It's called death.",
    "Lumpy. Nobody likes you. Even the zombies are only eating you to make it stop.",
  ],
  brian: [
    "Brian? Who let BRIAN in? He wasn't on the roster. He's not on any roster.",
    "Brian. Cool. Calm. Annoying. Stop looking so relaxed in MY gym.",
    "The Schnitz says it doesn't know where you came from, Brian. That makes two of us.",
  ],
};
export const ROAST_CHANCE = 0.45;   // when Erik would say a round or idle line
