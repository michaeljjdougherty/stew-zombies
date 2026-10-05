"""Build the first-person hand (assets/hands/hand.json + hand.bin) from the
rigged hand GLB ("3D Rigged Hand", Emma L. D. Lieker).

Output is in the same "hand space" as src/render/hands.js: wrist at the origin,
fingers hanging down -Y, palm facing +Z, thumb on the -X side, metres.
The skeleton is re-made with plain (unrotated) bones at the original joints,
and each bone carries the hinge axes the game bends it about:
  curl  - finger/thumb flexion (positive angle bends toward the palm)
  side  - spread / swing (positive moves toward the pinky side for fingers)
so src/render/handModel.js can pose it from the same curl/spread/thumb numbers
the old built-in hand used.

  python3 tools/hands/build_hand.py <hand.glb>
"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'guns'))
import glb

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'hands')
os.makedirs(OUT, exist_ok=True)

j, b = glb.load(SRC)
W = glb.world_mats(j)
(_, pr, _, at, idx), = list(glb.meshes(j, b, bake_skin=True))
P = at['POSITION'].astype(np.float64)
N = at['NORMAL'].astype(np.float64)
JI = at['JOINTS_0'].astype(np.int64)
JW = at['WEIGHTS_0'].astype(np.float64)
sk = j['skins'][0]
names = [j['nodes'][n]['name'] for n in sk['joints']]
jpos = np.array([W[n][:3, 3] for n in sk['joints']])

# source (cm): fingers +y, palm +x, thumb -z  ->  hand space: X = z, Y = -y, Z = x
R = np.array([[0, 0, 1], [0, -1, 0], [1, 0, 0]], float)
S = 0.18 / 23.0              # wrist to middle fingertip = 18 cm (the old hand's size)
WIDEN = 1.06                 # the model's palm is a touch narrow next to the sleeves
def tr(v):
    v = (v @ R.T) * S
    v[..., 0] *= WIDEN
    return v
# wrist height from the wrist joint; centred across and through on the knuckles
# (like the old hand, so the poses tuned for it still land)
origin = tr(jpos[names.index('radius_ulna')])
kn = tr(jpos[[names.index(f + '_prox') for f in ('index', 'midd', 'ring', 'pinky')]])
origin[0] = (kn[0, 0] + kn[3, 0]) / 2; origin[2] = kn[:, 2].mean()
P = tr(P) - origin
jpos = tr(jpos) - origin
N = (N @ R.T); N[:, 0] /= WIDEN; N /= np.linalg.norm(N, axis=1, keepdims=True)

parent = {}
for k, n in enumerate(sk['joints']):
    for c in j['nodes'][n].get('children', []):
        if c in sk['joints']: parent[sk['joints'].index(c)] = k

palm = np.array([0, 0, 1.0])
across = np.array([1.0, 0, 0.75]); across /= np.linalg.norm(across)   # where a thumb flexes to
def unit(v): return v / np.linalg.norm(v)
bones = []
for k, nm in enumerate(names):
    kids = [c for c, p in parent.items() if p == k]
    if kids: d = unit(jpos[kids[0]] - jpos[k])
    elif k in parent: d = unit(jpos[k] - jpos[parent[k]])
    else: d = np.array([0, -1.0, 0])
    if nm.startswith('thumb'):
        curl = unit(np.cross(d, across))
        side = unit(np.cross(d, np.array([-1.0, 0, 0])))     # swing out, away from the index
    else:
        curl = unit(np.cross(d, palm))
        side = np.array([0, 0, 1.0])
    bones.append({'name': nm, 'parent': names[parent[k]] if k in parent else None,
                  'pos': [round(float(x), 5) for x in jpos[k]],
                  'curl': [round(float(x), 4) for x in curl], 'side': [round(float(x), 4) for x in side]})

# pack
n = len(P)
I = idx.astype(np.uint16)
lo, hi = P.min(0), P.max(0)
q = np.round((P - lo) / (hi - lo) * 65535).astype(np.uint16)
nrm = np.zeros((n, 4), np.int8); nrm[:, :3] = np.round(N * 127).astype(np.int8)
order = np.argsort(-JW, axis=1)[:, :4]
JI4 = np.take_along_axis(JI, order, 1); JW4 = np.take_along_axis(JW, order, 1)
JW4 /= JW4.sum(1, keepdims=True)
w8 = np.round(JW4 * 255).astype(np.int16)
w8[:, 0] += 255 - w8.sum(1)
parts, layout, off = [], {}, 0
for key, arr in [('pos', q), ('nrm', nrm), ('si', JI4.astype(np.uint8)), ('sw', w8.astype(np.uint8)), ('idx', I)]:
    raw = np.ascontiguousarray(arr).tobytes()
    pad = (-off) % 4
    if pad: parts.append(b'\0' * pad); off += pad
    layout[key] = [off, arr.size]
    parts.append(raw); off += len(raw)
open(os.path.join(OUT, 'hand.bin'), 'wb').write(b''.join(parts))
meta = {'verts': n, 'tris': len(I) // 3, 'lo': lo.round(6).tolist(), 'hi': hi.round(6).tolist(), 'layout': layout, 'bones': bones,
        'credit': '3D Rigged Hand model (c) 2026 Emma L. D. Lieker'}
json.dump(meta, open(os.path.join(OUT, 'hand.json'), 'w'), indent=1)
print('hand:', n, 'verts', len(I) // 3, 'tris', off, 'bytes; extent', (hi - lo).round(3))
for bn in bones: print(bn['name'], bn['pos'])
