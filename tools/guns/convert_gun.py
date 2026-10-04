# Shrink a downloaded gun model for the game: textures down to webp (1024 or
# 512), very dense meshes thinned out, node transforms baked in (names kept so
# magazines etc. can be found), spec/gloss materials turned into metal/rough.
#   python3 convert_gun.py <in.glb> <out.glb> [maxTris=60000] [prune]
# prune: drop loose pieces (spare rounds, a display stand...) that sit outside
# the biggest connected piece's bounding box.
import sys, os, io, json, struct, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from glb import load, meshes, image_bytes

src, dst = sys.argv[1], sys.argv[2]
MAXTRI = int(sys.argv[3]) if len(sys.argv) > 3 else 60000
j, b = load(src)

def cluster(P, N, U, I, h, uq=64):
    cell = np.floor(P / h).astype(np.int64)
    cols = [cell[:, 0], cell[:, 1], cell[:, 2]]
    for k in sorted(U): cols += [np.floor(U[k][:, 0] * uq).astype(np.int64), np.floor(U[k][:, 1] * uq).astype(np.int64)]
    # don't weld across sharp edges: bucket the normal too
    nb = np.floor((N + 1) * 2).astype(np.int64); cols += [nb[:, 0], nb[:, 1], nb[:, 2]]
    key = np.stack(cols, 1)
    _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    n = inv.max() + 1; cnt = np.bincount(inv, minlength=n).astype(np.float64)[:, None]
    def avg(A):
        o = np.zeros((n, A.shape[1])); np.add.at(o, inv, A); return o / cnt
    P2, N2 = avg(P), avg(N); N2 /= np.linalg.norm(N2, axis=1, keepdims=True) + 1e-9
    U2 = {k: avg(v) for k, v in U.items()}
    T = inv[I]
    T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
    if len(T):
        _, ui = np.unique(np.sort(T, 1), axis=0, return_index=True); T = T[np.sort(ui)]
    used = np.unique(T); remap = -np.ones(n, np.int64); remap[used] = np.arange(len(used))
    return P2[used], N2[used], {k: v[used] for k, v in U2.items()}, remap[T]

prims = []
for ni, pr, W, at, idx in meshes(j, b, bake_skin=True):
    if pr.get('mode', 4) != 4: continue
    P = at['POSITION'].astype(np.float64) @ W[:3, :3].T + W[:3, 3]
    if 'NORMAL' in at:
        Nm = np.linalg.inv(W[:3, :3]).T
        N = at['NORMAL'] @ Nm.T; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    else: N = None
    if np.linalg.det(W[:3, :3]) < 0: idx = idx.reshape(-1, 3)[:, ::-1].reshape(-1)   # mirrored node: keep the winding
    U = {k: at[k].astype(np.float64) for k in ('TEXCOORD_0', 'TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3') if k in at}
    C = at.get('COLOR_0')
    prims.append({'name': j['nodes'][ni].get('name', 'part%d' % ni), 'P': P, 'N': N, 'U': U, 'C': C, 'I': idx.reshape(-1, 3).astype(np.int64), 'mat': pr.get('material')})

def components(P, I):
    key = np.round(P / (np.ptp(P, 0).max() * 1e-5 + 1e-12)).astype(np.int64)
    _, w = np.unique(key, axis=0, return_inverse=True); w = w.reshape(-1)
    par = np.arange(w.max() + 1)
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for t in w[I]:
        a, b2, c = find(t[0]), find(t[1]), find(t[2])
        par[b2] = a; par[c] = a
    roots = np.array([find(v) for v in w[I[:, 0]]])
    return roots

# crop={"maxY":0.05,"drop":["Object_42"]}: cut away everything above a height / whole nodes
if len(sys.argv) > 4 and sys.argv[4].startswith('crop='):
    cr = json.loads(sys.argv[4][5:])
    prims = [p for p in prims if p['name'] not in cr.get('drop', [])]
    for p in prims:
        for ax, k in ((0, 'X'), (1, 'Y'), (2, 'Z')):
            if 'max' + k in cr: p['I'] = p['I'][(p['P'][p['I']][:, :, ax] <= cr['max' + k]).all(1)]
            if 'min' + k in cr: p['I'] = p['I'][(p['P'][p['I']][:, :, ax] >= cr['min' + k]).all(1)]
    prims = [p for p in prims if len(p['I'])]
if len(sys.argv) > 4 and sys.argv[4] == 'prune':
    pieces = []
    for pi, p in enumerate(prims):
        r = components(p['P'], p['I'])
        for u in np.unique(r):
            m = r == u; V = p['P'][np.unique(p['I'][m])]
            pieces.append((pi, m, V.min(0), V.max(0), int(m.sum())))
    big = max(pieces, key=lambda q: q[4])
    lo, hi = big[2], big[3]; pad = (hi - lo) * 0.04; lo, hi = lo - pad, hi + pad
    keep = {pi: np.zeros(len(p['I']), bool) for pi, p in enumerate(prims)}
    dropped = 0
    for pi, m, a, c, n in pieces:
        if np.all(c >= lo) and np.all(a <= hi): keep[pi] |= m
        else: dropped += n
    for pi, p in enumerate(prims): p['I'] = p['I'][keep[pi]]
    prims = [p for p in prims if len(p['I'])]
    print(f'  pruned {dropped} loose tris')

tot = sum(len(p['I']) for p in prims)
allP = np.concatenate([p['P'] for p in prims]); diag = np.linalg.norm(allP.max(0) - allP.min(0))
if tot > MAXTRI:
    h = diag / 1400
    for it in range(12):
        out = []
        for p in prims:
            if p['N'] is None or p['C'] is not None or len(p['I']) < 200: out.append(p); continue
            P2, N2, U2, T2 = cluster(p['P'], p['N'], p['U'], p['I'], h)
            out.append({**p, 'P': P2, 'N': N2, 'U': U2, 'I': T2})
        t2 = sum(len(p['I']) for p in out)
        if t2 <= MAXTRI or it == 11: break
        h *= 1.3
    print(f'  thinned {tot} -> {t2} tris (cell {h:.4f}, diag {diag:.3f})')
    prims = out
else:
    print(f'  {tot} tris')

# --- materials ---------------------------------------------------------------
mats = []
for m in j.get('materials', []):
    m = json.loads(json.dumps(m))
    ext = m.get('extensions', {})
    sg = ext.pop('KHR_materials_pbrSpecularGlossiness', None)
    if sg:
        pbr = {'baseColorFactor': sg.get('diffuseFactor', [1, 1, 1, 1]), 'metallicFactor': 0.35, 'roughnessFactor': 1 - sg.get('glossinessFactor', 0.5) * 0.8}
        if 'diffuseTexture' in sg: pbr['baseColorTexture'] = sg['diffuseTexture']
        m['pbrMetallicRoughness'] = pbr
    if not ext and 'extensions' in m: del m['extensions']
    mats.append(m)

# --- images: down to webp ------------------------------------------------------
imgs = j.get('images', [])
S = 1024 if len(imgs) <= 4 else 512
normal_idx = set()
for m in mats:
    if 'normalTexture' in m: normal_idx.add(j['textures'][m['normalTexture']['index']]['source'])
new_imgs = []
for k in range(len(imgs)):
    data, mime = image_bytes(j, b, k)
    im = Image.open(io.BytesIO(data))
    alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB')
    if alpha and np.asarray(im)[..., 3].min() > 250: im = im.convert('RGB'); alpha = False
    s = min(S, max(im.size))
    if max(im.size) > s: im = im.resize((s, s) if im.size[0] == im.size[1] else (max(1, im.size[0] * s // max(im.size)), max(1, im.size[1] * s // max(im.size))), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=90 if k in normal_idx else 80, method=6)
    new_imgs.append(buf.getvalue())

# --- write -------------------------------------------------------------------
bin_, views, accs = bytearray(), [], []
def add(arr, comp, typ, target=None, minmax=False, normalized=False):
    raw = np.ascontiguousarray(arr).tobytes()
    while len(bin_) % 4: bin_.append(0)
    v = {'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(raw)}
    if target: v['target'] = target
    views.append(v); bin_.extend(raw)
    a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
    if normalized: a['normalized'] = True
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
nodes, gmeshes = [], []
for p in prims:
    att = {'POSITION': add(p['P'].astype(np.float32), 5126, 'VEC3', 34962, True)}
    if p['N'] is not None: att['NORMAL'] = add(p['N'].astype(np.float32), 5126, 'VEC3', 34962)
    for k, v in p['U'].items(): att[k] = add(v.astype(np.float32), 5126, 'VEC2', 34962)
    if p['C'] is not None: att['COLOR_0'] = add(np.asarray(p['C'], np.float32), 5126, 'VEC4' if p['C'].shape[1] == 4 else 'VEC3', 34962)
    I = p['I'].reshape(-1)
    ind = add(I.astype(np.uint16), 5123, 'SCALAR', 34963) if len(p['P']) < 65535 else add(I.astype(np.uint32), 5125, 'SCALAR', 34963)
    prim = {'attributes': att, 'indices': ind}
    if p['mat'] is not None: prim['material'] = p['mat']
    gmeshes.append({'primitives': [prim]})
    nodes.append({'name': p['name'], 'mesh': len(gmeshes) - 1})
images = []
for data in new_imgs:
    while len(bin_) % 4: bin_.append(0)
    views.append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data)}); bin_.extend(data)
    images.append({'bufferView': len(views) - 1, 'mimeType': 'image/webp'})
used_ext = [e for e in j.get('extensionsUsed', []) if e != 'KHR_materials_pbrSpecularGlossiness']
G = {'asset': {'version': '2.0', 'generator': 'stew-zombies convert_gun.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
     'nodes': nodes, 'meshes': gmeshes, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
if mats: G['materials'] = mats
if images: G['images'] = images; G['textures'] = j['textures']
if j.get('samplers'): G['samplers'] = j['samplers']
if used_ext: G['extensionsUsed'] = used_ext
js = json.dumps(G, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(bin_) % 4: bin_.append(0)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(dst, 'wb').write(out)
print(f'  {os.path.basename(dst)}: {len(out) / 1048576:.2f} MB ({len(images)} textures @ {S})')
