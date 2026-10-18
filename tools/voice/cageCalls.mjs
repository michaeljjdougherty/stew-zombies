// The cage's callouts (CAGE_CALLS in src/lore/crustCrew.js) as the lines that
// actually get said: the game fills in {name} (whoever it's about) and {round},
// and a recording only plays when its words match exactly. So each {name} line
// becomes one line per Crust character, and "Round {round}" becomes "Next round"
// (one recording for every round). -> [{ kind, who, text, about }]
export function cageCallLines(CAGE_CALLS, CREW, crew) {
  const out = [];
  for (const [kind, lines] of Object.entries(CAGE_CALLS || {})) {
    for (const l of lines) {
      const text = l.text.replace(/Round \{round\}/g, 'Next round').replace(/\{round\}/g, 'next');
      if (!text.includes('{name}')) { out.push({ kind, who: l.who, text }); continue; }
      for (const id of crew) {
        if (id === l.who) continue;
        out.push({ kind, who: l.who, text: text.replace(/\{name\}/g, CREW[id] ? CREW[id].name : id), about: id });
      }
    }
  }
  return out;
}
