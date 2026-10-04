# Hound model for the Cheddars: decimated, tinted cheddar-yellow, and skinned to
# a simple quadruped rig (body, neck, head, jaw, four 2-bone legs, 4-bone tail)
# by distance to each bone's segment. Writes <out>/hound.json, hound.bin and
# the textures (webp).
#   python3 build_hound.py <hound.glb> <outdir>
# Needs glb.py and cluster-style decimation (below); numpy + pillow only.
import sys, os, io, json, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from glb import load, meshes, image_bytes

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
j, b = load(src)

# --- merge and decimate (vertex clustering, keeping UV seams apart) ----------
Ps, Ns, U0, U1, Is, base = [], [], [], [], [], 0
for i, pr, W, at, idx in meshes(j, b):
    P = at['POSITION'] @ W[:3, :3].T + W[:3, 3]; N = at['NORMAL'] @ W[:3, :3].T
    Ps.append(P); Ns.append(N); U0.append(at['TEXCOORD_0']); U1.append(at['TEXCOORD_1']); Is.append(idx + base); base += len(P)
P = np.concatenate(Ps); N = np.concatenate(Ns); U0 = np.concatenate(U0); U1 = np.concatenate(U1); I = np.concatenate(Is).reshape(-1, 3)
H, UQ = 0.0105, 40
cell = np.floor(P / H).astype(np.int64)
k0 = np.floor(U0 * UQ).astype(np.int64); k1 = np.floor(U1 * UQ).astype(np.int64)
key = np.stack([cell[:, 0], cell[:, 1], cell[:, 2], k0[:, 0], k0[:, 1], k1[:, 0], k1[:, 1]], 1)
uk, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
n = len(uk); cnt = np.bincount(inv, minlength=n).astype(np.float64)[:, None]
def avg(A):
    o = np.zeros((n, A.shape[1])); np.add.at(o, inv, A); return o / cnt
P, N, U0, U1 = avg(P), avg(N), avg(U0), avg(U1)
N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
T = inv[I]
T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
_, ui = np.unique(np.sort(T, 1), axis=0, return_index=True); T = T[np.sort(ui)]
used = np.unique(T); remap = -np.ones(n, np.int64); remap[used] = np.arange(len(used))
T = remap[T]; P, N, U0, U1 = P[used], N[used], U0[used], U1[used]
print('hound:', len(P), 'verts', len(T), 'tris')

# --- rig (model space: head toward +z, feet on y=0) ---------------------------
# name, parent, joint position, segment end (what it "owns"), radius
BONES = [
    ('body', None, (0, 0.37, 0.0), (0, 0.40, 0.17), 0.15),
    ('hips', 'body', (0, 0.37, 0.0), (0, 0.33, -0.17), 0.15),
    ('neck', 'body', (0, 0.42, 0.18), (0, 0.52, 0.30), 0.09),
    ('head', 'neck', (0, 0.53, 0.30), (0, 0.555, 0.48), 0.075),
    ('jaw', 'head', (0, 0.49, 0.34), (0, 0.455, 0.46), 0.04),
]
for s, side in ((1, 'L'), (-1, 'R')):
    BONES += [
        ('fhip' + side, 'body', (s * 0.12, 0.36, 0.13), (s * 0.13, 0.19, 0.16), 0.06),
        ('fknee' + side, 'fhip' + side, (s * 0.13, 0.19, 0.16), (s * 0.14, 0.03, 0.21), 0.035),
        ('rhip' + side, 'hips', (s * 0.11, 0.35, -0.12), (s * 0.12, 0.17, -0.17), 0.065),
        ('rknee' + side, 'rhip' + side, (s * 0.12, 0.17, -0.17), (s * 0.13, 0.03, -0.14), 0.035),
    ]
TAIL = [(0.0, 0.38, -0.20), (0.03, 0.32, -0.28), (0.06, 0.22, -0.35), (0.07, 0.17, -0.44), (0.08, 0.24, -0.505)]
for k in range(4):
    BONES.append(('tail%d' % k, 'hips' if k == 0 else 'tail%d' % (k - 1), TAIL[k], TAIL[k + 1], 0.035 if k else 0.05))

def seg_dist(X, a, c):
    a, c = np.array(a), np.array(c); ab = c - a
    t = np.clip(((X - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(X - (a + t[:, None] * ab), axis=1)
D = np.stack([seg_dist(P, bb[2], bb[3]) / bb[4] for bb in BONES], 1)
# keep the left legs off the right side and vice versa, and legs off the head/tail
for bi, bb in enumerate(BONES):
    nm = bb[0]
    if nm[-1] in 'LR' and ('hip' in nm or 'knee' in nm):
        wrong = (P[:, 0] * (1 if nm[-1] == 'L' else -1)) < -0.02
        D[wrong, bi] = 1e3
W = 1.0 / np.maximum(D, 0.25) ** 6
top = np.argsort(-W, 1)[:, :4]
w4 = np.take_along_axis(W, top, 1); w4 /= w4.sum(1, keepdims=True)
w8 = np.round(w4 * 255).astype(np.int32)
w8[:, 0] += 255 - w8.sum(1)
counts = np.bincount(top[:, 0], minlength=len(BONES))
print('verts per main bone:', {bb[0]: int(c) for bb, c in zip(BONES, counts)})

# --- pack ---------------------------------------------------------------------
lo, hi = P.min(0), P.max(0)
q = np.round((P - lo) / (hi - lo) * 65535).astype(np.uint16)
nq = np.round(N * 127).astype(np.int8)
nq4 = np.zeros((len(N), 4), np.int8); nq4[:, :3] = nq
uv0 = np.round(np.clip(U0, 0, 1) * 65535).astype(np.uint16)
uv1 = np.round(np.clip(U1, 0, 1) * 65535).astype(np.uint16)
parts = [('pos', q), ('nrm', nq4), ('uv0', uv0), ('uv1', uv1), ('si', top.astype(np.uint8)), ('sw', w8.astype(np.uint8)), ('idx', T.astype(np.uint16))]
blob, layout, off = b'', {}, 0
for name, arr in parts:
    raw = arr.tobytes(); pad = (-len(raw)) % 4
    layout[name] = [off, arr.size]; blob += raw + b'\0' * pad; off += len(raw) + pad
open(os.path.join(out, 'hound.bin'), 'wb').write(blob)
meta = {
    'verts': len(P), 'tris': len(T), 'lo': lo.tolist(), 'hi': hi.tolist(), 'layout': layout,
    'bones': [{'name': bb[0], 'parent': bb[1], 'pos': list(bb[2])} for bb in BONES],
    'textures': {'map': 'hound_d.webp', 'normalMap': 'hound_n.webp', 'roughnessMap': 'hound_mr.webp'},
}
json.dump(meta, open(os.path.join(out, 'hound.json'), 'w'))

# --- textures: muscle red -> cheddar yellow -------------------------------------
def tex(k):
    data, _ = image_bytes(j, b, k); return Image.open(io.BytesIO(data)).convert('RGB')
col = tex(0).resize((2048, 2048), Image.LANCZOS)
hsv = np.asarray(col.convert('HSV')).astype(np.float32)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
h = np.full_like(h, 34.0) + (h - h.mean()) * 0.15          # PIL hue 0..255: ~34 = golden yellow
s = np.clip(s * 1.15 + 20, 0, 255)
v = np.clip(v * 1.22 + 10, 0, 255)
yel = Image.fromarray(np.stack([h, s, v], -1).astype(np.uint8), 'HSV').convert('RGB')
yel.save(os.path.join(out, 'hound_d.webp'), quality=82, method=6)
tex(2).resize((1024, 1024), Image.LANCZOS).save(os.path.join(out, 'hound_n.webp'), quality=88, method=6)
tex(1).resize((512, 512), Image.LANCZOS).save(os.path.join(out, 'hound_mr.webp'), quality=85, method=6)
print('bin', len(blob), 'bytes; textures written')
