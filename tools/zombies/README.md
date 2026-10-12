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

## Call of the Crust's island zombies (GLB sources)

`conv_char.mjs` also reads `.glb` files (`glbload.mjs`; Sketchfab-style
`mixamorig:Hips_65` bone names are fine). Models that come without a rig are
rigged first by `autorig.mjs` (needs `@gltf-transform`): it scales a reference
zombie's skeleton to the model, finds which way the arms hang, and weights
each vertex to its nearest bones.

```
node autorig.mjs zombie_corpse.glb ghoul.glb ../../assets/zombies/ch10.json 182
node autorig.mjs skeleton_low.glb skeleton.glb ../../assets/zombies/ch10.json 176
node conv_char.mjs ghoul.glb ghoul out/models out/png "[[3.2,9,null],[-3.2,9,null],1.4]"
node conv_char.mjs skeleton.glb skeleton out/models out/png "[[3.2,9,null],[-3.2,9,null],2.6]"
node conv_char.mjs labzombie.glb labzombie out/models out/png "[[-3.81,12.02,15.94],[2.85,12.38,15.82],0.95]"   # test-facility-zombie, simplified to 30k tris
node conv_char.mjs walkzombie.glb walkzombie out/models out/png "[[2.61,9.97,10.53],[-3.38,9.8,10.58],1.75]"  # zombie_walk_test, spec-gloss -> metal-rough first
python3 tex.py out/models out/png labzombie walkzombie ghoul skeleton
```
