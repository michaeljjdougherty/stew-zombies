# Zombie models

Turns the Mixamo characters and animations (FBX) into the compact files the
game loads from `assets/zombies/`. The source FBX files aren't in the repo
(they're big); the converted, game-ready versions are.

```
SRC=<folder of character FBXs> ANIM=<folder of animation FBXs> OUT=/tmp/zout ./build.sh
cp /tmp/zout/models/{*.json,*.bin,*.webp} ../../assets/zombies/   # not the *.uv.json
```

Needs Node (with `three` resolvable, plus three's FBXLoader addon) and Python
with Pillow and NumPy.

- `conv_char.mjs` bakes each character into its T-pose, merges its meshes by
  material, drops duplicate vertices, quantizes (int16 positions, int8
  normals, uint8 skin weights) and scales it so the hips sit 100 units up.
  It also writes UV masks (skin, clothes, eyes, mouth) for the texture step.
- `conv_anim.mjs` packs the clips (int16 quaternions), normalizes the hip
  height to match, strips the forward drift from the walk/run/sprint/crawl
  loops and records how fast each one's feet travel.
- `tex.py` shrinks the textures to WebP, folds alpha in, zombifies the
  ordinary people (grey-green dead skin, bruising, veins, dirty clothes, blood,
  sunken eyes, a bloody mouth) and paints every zombie's eyes into a green
  emissive map.
- Eye centres for rigs without eye bones are in `build.sh` (found with
  `eyeprobe.mjs`, which looks for small, separate, symmetric eyeball pieces).
