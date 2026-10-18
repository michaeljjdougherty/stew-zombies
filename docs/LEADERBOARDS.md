# Online leaderboards: the Firebase rules

The Career screen's **Leaderboards** tab (`src/career/leaderboards.js`,
`LeaderboardsUI` in `src/ui/careerUI.js`) keeps one entry per username at
`leaderboards/<name key>` in the `stew-zombies-default-rtdb` database:

```
{ name, uid, t, kills, headshots, revives, wallBuys, games,
  schoolSolo, schoolCoop, crustSolo, crustCoop }
```

The totals are the career's stats. The four round boards are the highest round
reached in a game played to game over on that map, solo or co-op. An entry is
written when a game ends and again at each sign-in (totals only, plus any game
that couldn't go up while offline). Guests and the all-access dev accounts
(`CONFIG.shop.allAccess`, PHAT CHOPS) are never written.

## What to paste in the Firebase console

Realtime Database → **Rules**. Add this `leaderboards` block inside `"rules"`,
next to the existing `players` block (keep `players` as it is), then
**Publish**:

```json
"leaderboards": {
  ".read": true,
  ".indexOn": ["kills", "headshots", "revives", "wallBuys", "games", "schoolSolo", "schoolCoop", "crustSolo", "crustCoop"],
  "$key": {
    ".write": "auth != null && root.child('players/' + $key + '/uid').val() === auth.uid",
    ".validate": "newData.hasChildren(['name', 'uid', 't'])",
    "name": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 16" },
    "uid": { ".validate": "newData.val() === auth.uid" },
    "t": { ".validate": "newData.val() === now" },
    "kills": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
    "headshots": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
    "revives": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
    "wallBuys": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
    "games": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
    "schoolSolo": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 255" },
    "schoolCoop": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 255" },
    "crustSolo": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 255" },
    "crustCoop": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 255" },
    "$other": { ".validate": false }
  }
}
```

- **`.write`**: only the account that owns the career at `players/<key>` can
  write its leaderboard entry.
- **`.indexOn`**: lets each board ask the database for just its top 100. Until
  it's there the boards still work: the game downloads every entry and sorts
  them itself (the browser console shows a harmless 400 for the first try).
- The caps match `CONFIG.career.leaderboard` (`maxRound`, `maxTotal`). Change
  both together.

## Limits

The scores come from the player's own browser, so the caps keep out mistakes
and obvious nonsense, not a determined cheater. Anyone who reads the JS can
write a believable score for their own username. To clear a bad entry, delete
`leaderboards/<name key>` in the console's Data tab.
