// =============================================================================
// Patch notes: what's new, shown once when the game opens after an update
// (and any time from Extras → Patch notes), with a thank-you from Michael and
// James at the top.
// =============================================================================

export const PATCH = {
  version: '2026-10-16a',
  date: 'October 16, 2026',
  thanks: {
    photo: 'assets/ui/thanks.jpg',
    alt: 'Michael and James in the office, holding a jar of peanut butter and a box of Quaker oatmeal',
    text: [
      "Thank you for playing Stew Zombies. We made this one for the Stew crew: for every late night, every terrible shot and every \"one more round.\"",
      "Today was a big one. There's a whole story now, a quest to finish, real guns, real hands, online co-op so you can play together, and a lot of Erik. Go squad up and take him down.",
      "See you at center court.",
    ],
    from: 'Michael & James',
  },
  sections: [
    { title: 'Coming soon', items: [
      'Something crusty is coming…',
    ] },
    { title: 'Stew Zombies 2.0', items: [
      'A whole new main menu: four blades, the charred pages of an old book. Play (every way to play), GobbleGum (your pack and your Liquid Divinium), Extras (your career, the trailer, the story) and Settings. Flip between them with the arrow keys, the bumpers, or a click.',
      'Can\'t remember your username exactly? The sign-in screen lists every username so far: pick yours, then type your PIN.',
      'Welcome gift: sign in before October 31 and you get 30 Liquid Divinium and one of every Mega GobbleGum (once per username).',
      'The rest of the menus are pages from the same burnt book now: pause, settings, map select, your GobbleGum pack, and the game over and victory screens.',
      'Dr. Monty\'s Factory is its own room now, like Black Ops 3\'s: pick 1, 2 or 3 vats, pour in that many vials of Liquid Divinium, and watch the vats brew your Mega GobbleGums.',
      'Two maps, two writers: Stew Leonard High by James Amarante, Call of the Crust by Michael Dougherty.',
      'New menu music: The Kettle Liturgy. Miss the old theme? Settings › Menu music brings it back.',
      'Big Evil Zach\'s fight on Call of the Crust has a soundtrack now.',
      'GobbleGum machines are real gumball machines, and every gum has its own logo (in the menu, on your HUD, and over the machine when your gum comes out).',
      'New sounds: the launch pads\' launch and landing, and the Fucci Gun Mk 2\'s laser.',
      'The game draws a lot less every frame (far-off specks, still scenery, the crew), so it should run smoother.',
    ] },
    { title: 'Just added', items: [
      'GobbleGum: all 64 gums. Build a pack of 5 on the GobbleGum screen (title menu), then buy one from the GobbleGum machines next to the perk machines (500, 1000, then 2000 points, 3 a round). Activated gums go off with H (D-pad down on a controller). Classics never run out; Megas are used up as they come out of the machine.',
      'Liquid Divinium: earn vials by playing (the longer you last, the more), saved to your username. Spend them at Dr. Monty\'s Factory for Mega GobbleGums.',
      'Mad Dog\'d guns have alternate ammo now (Blast Furnace, Dead Wire or Thunder Wall). Feed an upgraded gun back to the Mad Dog for 2500 to get a different one.',
      'Online: the intro cutscene plays for everyone, and the host can skip it (or switch it off in the lobby).',
      'Rocco has his real voice: all 62 of his lines are recorded.',
      'Usernames have a 4-digit PIN now: make one the first time you use a name, and only you can sign in as it from then on.',
      'The Easter egg\'s final fight is a lot tougher.',
      'Careers: sign in with a username when the game starts (use the same one every time). Your kills, revives, rounds survived and more are saved to it. See them under Career & Achievements on the title screen.',
      'Achievements: ten to start, 500G in all, with a pop-up the moment you earn one.',
      'A Tiger Fish Interactive logo (and some company) when the game starts up.',
      'More graphics settings for slower computers: a quality preset (Low, Medium, High, Ultra), auto resolution that drops the resolution when the frame rate dips, a frame rate cap, sharpness for high-res screens, how many real lights there are, an effects level (particles, snow, blood marks, how long bodies stay), and simple zombie and gun models. Render scale now goes down to 35%.',
      'Easter egg expanded.',
      'Walkthrough or Hardcore: pick on the map screen. Walkthrough shows each step of the Easter egg. Hardcore is classic zombies: no objective, no hints, figure it out.',
      'Explore has a menu now (B, or View on a controller): spawn in any gun (plain or Mad Dog\'d), start any round, switch the zombies on or off, and jump to any part of the Easter egg.',
      'Easier: fewer zombies per round (especially with four players) and every gun hits 20% harder.',
      'The Chopper\'s blast is a narrower, shorter cone.',
      'Lighting: no more blinding glare. Shiny surfaces (steel counters, table tops, the cows) don\'t mirror the lights any more, and the glow around bright things is softer.',
      'A zombie\'s green eyes go dark the instant it dies.',
      'Erik has a real voice now. All 115 of his lines are recorded: every taunt over the PA, every intercom reply, his roasts, and his scenes in the intro.',
      'Kearns and Ryan are voiced too: their reactions, walkie-talkie calls, story lines, banter, their lines in the intro, and what they say into the intercom when you play them. Pit and Brian still use the placeholder voices for now.',
      'An intro cutscene: Erik getting cut in the locker room, his bargain with The Schnitz in the boiler room, and championship night going very wrong. It plays the first time you start Stew Leonard High. Watch it again from the map screen or Extras.',
      'Map select: press Play to open a star chart you can drag and zoom. Stew Leonard High sits on its asteroid (the real level, drawn to scale), and the maps still to come are planets with a hint each.',
      'The Chopper is a real wonder weapon now: every shot is a wall of wind that kills and throws every zombie in its path, with a deep boom and a howling roar.',
      'Lighting: white things (like the papers all over the floors) no longer glow like light bulbs.',
      'Brian is pickable online the moment you finish The Final Whistle, even if you\'re still in the same lobby.',
    ] },
    { title: 'Out of Bounds: the story', items: [
      'A whole new story by James Amarante. The undefeated Stew Leonards cut Erik Madsen (#8) right before the championship. He sold his soul to The Schnitz for revenge, and at tip-off he struck.',
      'Erik talks to you all night over the PA. There are eight notes to find (new: The Bargain).',
      'Championship night around the school: the Press Box over center court, a blood-streaked court, fiberglass dairy cows, an animatronic cow band and the Rule #1 rock. The principal\'s office is now the Teachers\' Lounge.',
    ] },
    { title: 'The crew and online co-op', items: [
      'Kearns, Ryan, Pit and Rocco are playable, with walkie-talkie banter and Erik roasting each of you. Brian unlocks after the quest.',
      'Play Online: host a game, share the room code or invite link, and everyone picks their own character. Teammates show up with their guns and name tags, revives work across the network, and you respawn next round.',
      'Hold Tab (View on a controller) for the scoreboard: points, kills, headshots, downs and revives.',
      'When you\'re out, you spectate a living teammate over their shoulder. Click or RT to switch who you\'re watching.',
    ] },
    { title: 'Zombies and Cheddars', items: [
      'Eight new zombie characters: ordinary people, zombified, with glowing green eyes. Limbs come off, and they fall the way you hit them.',
      'A new zombie walk mixed in with the old one, and they reach through the barriers at you.',
      'Cheddar Rounds bring yellow skinless hounds that gallop, lunge and keep asking if you wanna play 2K.',
    ] },
    { title: 'Guns and hands', items: [
      '26 real gun models replace the built-in looks.',
      'Brand-new first-person hands that actually hold the guns: back strap in the web of the hand, fingers wrapped round the grip, index finger on the trigger, thumb along the side. The other hand cups the pistol, clamps the handguard or wraps the foregrip.',
      'Stronger recoil: the camera punches, the gun kicks back in your hands and your aim climbs.',
      'Fixed guns that showed up white and glowing.',
    ] },
    { title: 'The school', items: [
      'New perk machines, each painted in its perk\'s colour with its name and symbol.',
      'Perks come in a glass flask filled with the perk\'s colour. You pop the cork and drink it.',
      'A new look for the Mad Dog Machine, in dark gunmetal and blood red with a dog\'s head badge.',
      'A new Mystery Box (the lid swings open), a new championship trophy, and a jukebox in the Teachers\' Lounge that plays "We Go Stewie" and "That\'s That Marmaduke".',
      'Clearance Sale drops a Mystery Box at every box spot, and a cheesy game-show tune plays until it ends.',
      'The boiler room has a bubbling stew cauldron. Shoot its three valves.',
    ] },
    { title: 'Fixes and feel', items: [
      'You get 3 seconds of invincibility after being revived.',
      'The screen edges throb red when you\'re one hit from going down.',
      'Sound now starts on your first click, tap or key after a refresh (with a prompt until then).',
      'Lighting adjusts to the dark and to the power coming on.',
      'Crash fixes, so one bad frame can no longer stop the game.',
    ] },
  ],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The notes as HTML (used by the pop-up and by the Extras tab).
export function patchNotesHTML() {
  const T = PATCH.thanks;
  const thanks = `<figure class="pn-thanks">
      <img src="${T.photo}" alt="${esc(T.alt)}" width="640" height="617" loading="eager">
      <figcaption>
        <h4>A note from us</h4>
        ${T.text.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="pn-sign">${esc(T.from)}</p>
      </figcaption>
    </figure>`;
  const secs = PATCH.sections.map((s) => `<h4>${esc(s.title)}</h4><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
  return `${thanks}${secs}`;
}

const KEY = 'stew-zombies-patch-seen';

// The pop-up that greets you once per update.
export class PatchNotes {
  constructor() {
    this.el = document.getElementById('patchnotes');
    this.body = document.getElementById('pn-body');
    this.isOpen = false;
    document.getElementById('pn-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true);
  }

  seen() {
    try { return localStorage.getItem(KEY) === PATCH.version; } catch { return false; }
  }

  // Show it if this update hasn't been seen on this browser yet.
  maybeShow() { if (!this.seen()) this.show(); }

  show() {
    this.body.innerHTML = patchNotesHTML();
    document.getElementById('pn-date').textContent = PATCH.date;
    this.el.hidden = false;
    this.isOpen = true;
    this.body.scrollTop = 0;
    document.getElementById('pn-close').focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.isOpen = false;
    try { localStorage.setItem(KEY, PATCH.version); } catch { /* private window: it'll show again next time */ }
    if (this.onClose) this.onClose();
  }
}
