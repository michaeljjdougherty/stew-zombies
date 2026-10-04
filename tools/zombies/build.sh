#!/bin/bash
# Rebuild the zombie models: FBX -> compact models + clips -> textures -> assets/zombies
set -e
SRC=${SRC:?folder of character FBXs}
ANIM=${ANIM:?folder of animation FBXs}
OUT=${OUT:-/tmp/zout}
HERE=$(cd "$(dirname "$0")" && pwd)
rm -rf "$OUT/models"; mkdir -p "$OUT/models" "$OUT/png"
conv() { node --max-old-space-size=8000 "$HERE/conv_char.mjs" "$SRC/$1.fbx" "$2" "$OUT/models" "$OUT/png" "$3" | tail -1; }
# eye guesses (x, y, z, radius from the Head bone) for rigs without eye bones
conv Ch01_nonPBR ch01 "[[3.05,8.14,10.34],[-3.05,8.14,10.34],1.45]"
conv Ch10_nonPBR ch10 "[[2.85,10.06,11.42],[-2.85,10.06,11.42],1.3]"
conv Ch22_nonPBR ch22 "[[3.16,8.78,12.71],[-3.16,8.78,12.71],1.4]"
conv Ch31_nonPBR ch31 "[[3.36,10.46,11.35],[-3.36,10.46,11.35],1.5]"
conv Remy remy ""
conv "Yaku J Ignite" yaku "[[3.5,4,null],[-3.5,4,null],1.3]"
conv "Zombiegirl W Kurniawan" girl "[[3.32,6.75,7.86],[-3.4,6.75,7.86],1.7]"
conv copzombie_l_actisdato cop "[[3.99,4.61,8.72],[-2.41,4.66,8.8],1.7]"
node --max-old-space-size=8000 "$HERE/conv_anim.mjs" "$ANIM" "$OUT/models" | tail -1
python3 "$HERE/tex.py" "$OUT/models" "$OUT/png"
