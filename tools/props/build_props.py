# Build the prop models the game loads from assets/props/ (see README).
#   python3 tools/props/build_props.py <out dir>
# Sources (downloaded models) are read from the paths below.
import sys, os, io, json, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..', 'guns')); sys.path.insert(0, HERE)
from glb import load, meshes, image_bytes, write_glb
from blend import read_meshes

UP = '/mnt/user-data/uploads'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/props'
os.makedirs(OUT, exist_ok=True)

def webp(img, size=1024, q=82, lossless=False):
    im = img if isinstance(img, Image.Image) else Image.open(io.BytesIO(img))
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() > 250: im = im.convert('RGB')
    if max(im.size) > size: im.thumbnail((size, size), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6, lossless=lossless); return b.getvalue()

def smooth_normals(P, I):
    key = np.round(P / (np.ptp(P, 0).max() * 1e-5 + 1e-12)).astype(np.int64)
    _, w = np.unique(key, axis=0, return_inverse=True); w = w.reshape(-1)
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    fn = np.cross(b - a, c - a)
    acc = np.zeros((w.max() + 1, 3))
    for k in range(3): np.add.at(acc, w[I[:, k]], fn)
    N = acc[w]; return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def gltf_prims(path):
    j, b = load(path); prims = []
    for ni, pr, W, at, idx in meshes(j, b, bake_skin=True):
        P = at['POSITION'].astype(np.float64) @ W[:3, :3].T + W[:3, 3]
        N = None
        if 'NORMAL' in at:
            N = at['NORMAL'] @ np.linalg.inv(W[:3, :3]); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
        I = idx.reshape(-1, 3)
        if np.linalg.det(W[:3, :3]) < 0: I = I[:, ::-1]
        prims.append({'name': j['nodes'][ni].get('name', 'part'), 'P': P, 'N': N, 'U': {k: at[k] for k in ('TEXCOORD_0',) if k in at}, 'I': I, 'mat': pr.get('material')})
    return j, b, prims

def report(name, n): print(f'{name}: {n / 1048576:.2f} MB')

# --- Blockbench pixel-art machines: keep the pixel texture crisp (PNG, nearest)
for name, src in (('juggernog', f'{UP}/low-poly-juggernog-machine-cod-zombies 2/source/model.gltf'), ('pap', f'{UP}/minecraft-pack-a-punch-machine/source/model.gltf')):
    j, b, prims = gltf_prims(src)
    imgs = [(image_bytes(j, b, k)[0], 'image/png') for k in range(len(j.get('images', [])))]
    mats = j['materials']
    for m in mats: m['doubleSided'] = True
    report(name, write_glb(f'{OUT}/{name}.glb', prims, mats, imgs, textures=j['textures'], samplers=j['samplers']))

# --- the Mystery Box
j, b, prims = gltf_prims(f'{UP}/mystery-box 2/source/Mystery box.glb')
imgs = [(webp(image_bytes(j, b, k)[0], 1024), 'image/webp') for k in range(len(j['images']))]
for p, (ni, pr, W, at, idx) in zip(prims, meshes(j, b)): p['name'] = j['materials'][pr['material']]['name'] if 'material' in pr else p['name']
report('mysterybox', write_glb(f'{OUT}/mysterybox.glb', prims, j['materials'], imgs, textures=j['textures'], samplers=j.get('samplers')))

# --- the jukebox (FBX dumped by extract_fbx.mjs)
J = json.load(open('/tmp/claude-0/m2/jukebox.json'))
T = f'{UP}/jukebox/textures/jukebox4k_'
bc = webp(Image.open(T + 'bc.png'), 2048)
nrm = webp(Image.open(T + 'n.png'), 1024, 88)
r = np.asarray(Image.open(T + 'r.png').convert('L').resize((1024, 1024), Image.LANCZOS))
mt = np.asarray(Image.open(T + 'm.png').convert('L').resize((1024, 1024), Image.LANCZOS))
ao = np.asarray(Image.open(T + 'ao.png').convert('L').resize((1024, 1024), Image.LANCZOS))
mr = webp(Image.fromarray(np.stack([ao, r, mt], -1).astype(np.uint8)), 1024, 85)
em = webp(Image.open(T + 'e.png'), 1024)
prims = []
for m in J:
    P = np.array(m['P']).reshape(-1, 3); I = np.array(m['I']).reshape(-1, 3)
    prims.append({'name': m['mat'], 'P': P, 'N': np.array(m['N']).reshape(-1, 3) if m['N'] else smooth_normals(P, I), 'U': {'TEXCOORD_0': np.array(m['U']).reshape(-1, 2)} if m['U'] else {}, 'I': I, 'mat': 0})
mats = [{'name': 'jukebox', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2}, 'metallicFactor': 1, 'roughnessFactor': 1},
         'normalTexture': {'index': 1}, 'occlusionTexture': {'index': 2}, 'emissiveTexture': {'index': 3}, 'emissiveFactor': [1, 1, 1]}]
report('jukebox', write_glb(f'{OUT}/jukebox.glb', prims, mats, [(bc, 'image/webp'), (nrm, 'image/webp'), (mr, 'image/webp'), (em, 'image/webp')]))

# --- the trophy (Blender file, Z up -> Y up)
T = f'{UP}/golden-trophy/textures/'
prims = []
for m in read_meshes(f'{UP}/golden-trophy/source/gold.blend'):
    P = m['P'][:, [0, 2, 1]] * np.array([1, 1, -1]); I = m['I'][:, ::-1]
    U = m['U'].copy(); U[:, 1] = 1 - U[:, 1]
    prims.append({'name': m['name'], 'P': P, 'N': smooth_normals(P, I), 'U': {'TEXCOORD_0': U}, 'I': I, 'mat': 0})
g = np.asarray(Image.open(T + 'Material_metallic-Material_roughness@channels=G.png').convert('RGB').resize((1024, 1024)))[..., 1]
bm = np.asarray(Image.open(T + 'Material_metallic-Material_roughness@channels=B.png').convert('RGB').resize((1024, 1024)))[..., 2]
trmr = webp(Image.fromarray(np.stack([np.full_like(g, 255), g, bm], -1)), 1024, 85)
mats = [{'name': 'gold', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2}, 'metallicFactor': 1, 'roughnessFactor': 1}, 'normalTexture': {'index': 1}}]
report('trophy', write_glb(f'{OUT}/trophy.glb', prims, mats, [(webp(Image.open(T + 'Material_baseColor.jpeg'), 1024), 'image/webp'), (webp(Image.open(T + 'Material_normal.png'), 1024, 88), 'image/webp'), (trmr, 'image/webp')]))

# --- the perk bottle (OBJ): glass, the drink inside, bubbles, cork, labels
V, VT, VN, groups, cur = [], [], [], {}, None
for line in open('/tmp/claude-0/m2/bottle/BOTELLITA.obj'):
    t = line.split()
    if not t: continue
    if t[0] == 'v': V.append([float(x) for x in t[1:4]])
    elif t[0] == 'vt': VT.append([float(x) for x in t[1:3]])
    elif t[0] == 'vn': VN.append([float(x) for x in t[1:4]])
    elif t[0] in ('o', 'g'): cur = t[1]; groups.setdefault(cur, [])
    elif t[0] == 'f': groups[cur].append([[int(x) if x else 0 for x in (c.split('/') + ['', ''])[:3]] for c in t[1:]])
V, VT, VN = np.array(V), np.array(VT), np.array(VN)
ROLE = {'Capsule001': ('glass', 0), 'Object002': ('drink', 1), 'Object003': ('cork', 2), 'Object005': ('label', 3), 'Object006': ('label', 3), 'Object008': ('tag', 4)}
prims = []
for gname, F in groups.items():
    if not F: continue
    role, mi = ROLE.get(gname, ('bubble', 5))
    P, U, N, I = [], [], [], []
    for f in F:
        base = len(P)
        for vi, ti, ni in f:
            P.append(V[vi - 1]); U.append((VT[ti - 1][0], 1 - VT[ti - 1][1]) if ti else (0, 0)); N.append(VN[ni - 1] if ni else (0, 1, 0))
        for k in range(1, len(f) - 1): I.append((base, base + k, base + k + 1))
    P = np.array(P) * 0.01; P[:, 1] -= 0.0444   # cm -> m, sitting on y = 0
    prims.append({'name': role, 'P': P, 'N': np.array(N), 'U': {'TEXCOORD_0': np.array(U)}, 'I': np.array(I), 'mat': mi})
T = f'{UP}/poison-glass-bottle 3/textures/'
mats = [
    {'name': 'glass', 'pbrMetallicRoughness': {'baseColorFactor': [0.85, 0.92, 0.95, 0.28], 'metallicFactor': 0, 'roughnessFactor': 0.06}, 'alphaMode': 'BLEND', 'doubleSided': True},
    {'name': 'drink', 'pbrMetallicRoughness': {'baseColorFactor': [1, 0.2, 0.15, 0.92], 'metallicFactor': 0, 'roughnessFactor': 0.2}, 'alphaMode': 'BLEND'},
    {'name': 'cork', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.9}},
    {'name': 'label', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 1}, 'metallicFactor': 0, 'roughnessFactor': 0.85}, 'doubleSided': True},
    {'name': 'tag', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 2}, 'metallicFactor': 0, 'roughnessFactor': 0.85}, 'alphaMode': 'MASK', 'doubleSided': True},
    {'name': 'bubble', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 0.35], 'metallicFactor': 0, 'roughnessFactor': 0.05}, 'alphaMode': 'BLEND'},
]
report('bottle', write_glb(f'{OUT}/bottle.glb', prims, mats, [(webp(Image.open(T + 'tapón_corcho.jpg'), 512), 'image/webp'), (webp(Image.open(T + 'etioqueta.png'), 1024), 'image/webp'), (webp(Image.open(T + 'ETIQUETA_2.png'), 512), 'image/webp')]))
