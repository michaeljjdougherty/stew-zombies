# Stew Zombies

Read `docs/HANDOFF.md` before anything else. It covers what's built since the
README, the rules we work by, how to publish the artifact, and which parts of
the code each parallel thread owns. The README covers Phases 1–9 and the code
layout.

## Working in parallel

- Several Claude threads work on this repo at once. Stay inside the files your
  thread owns (the table in `docs/HANDOFF.md`). The hotspot files listed there
  get small edits only.
- Michael and James push straight to `master`, so fetch and merge `master`
  before you start and again before you push.
- Claude threads work on their own branch and open a pull request. Michael
  merges it; never push to `master` yourself.
- Run the headless tests before every push: `node tests/<name>_headless.mjs`,
  always including `tests/syntax_headless.mjs`.
- Only the MASTER LAUNCHER thread publishes the artifact. Other threads never
  publish; their work reaches the game when Michael merges their pull request.
