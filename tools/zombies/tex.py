"""Textures for the zombie models: resize, fold alpha in, zombify the ones
that are ordinary people, paint glowing eyes, write WebP. Updates <id>.json.

usage: python3 tex.py <modelsDir> <pngDir> [ids...]
"""
import json, sys, os, math, zlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MODELS, PNG = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
SIZE = 1024
NORMAL_SIZE = 1024

# ordinary people who need turning into zombies (and how far)
PEOPLE = {'ch01', 'ch22', 'ch31', 'remy'}

def load(name):
    return Image.open(os.path.join(PNG, name + '.png'))

def noise(h, w, scale, seed, octaves=4):
    """fractal value noise in [0,1]"""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(1, int(scale * (2 ** o)))
        g = rng.random((s + 1, s + 1)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(im, np.float32) / 255 * amp
        tot += amp
        amp *= 0.5
    return out / tot

def splats(h, w, count, seed, rmin, rmax, mask=None):
    """blood splatter mask (0..1): blobs with drips"""
    rng = np.random.default_rng(seed)
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    ys, xs = (np.nonzero(mask > 0.5) if mask is not None else (None, None))
    for _ in range(count):
        if mask is not None and len(xs):
            k = rng.integers(len(xs)); cx, cy = xs[k], ys[k]
        else:
            cx, cy = rng.integers(w), rng.integers(h)
        r = rng.uniform(rmin, rmax)
        for _ in range(int(6 + r / 3)):
            a = rng.uniform(0, 2 * math.pi); dd = rng.uniform(0, r)
            rr = rng.uniform(r * 0.15, r * 0.6)
            x, y = cx + math.cos(a) * dd, cy + math.sin(a) * dd
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=int(rng.uniform(150, 255)))
        for _ in range(rng.integers(0, 4)):   # drips
            x = cx + rng.uniform(-r, r) * 0.6
            ln = rng.uniform(r, r * 4)
            d.line([x, cy, x + rng.uniform(-2, 2), cy + ln], fill=200, width=max(1, int(r * 0.12)))
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    return np.asarray(im, np.float32) / 255

def zombify(rgb, skin, cloth, eyes, seed, mouth=None):
    """rgb float 0..1 (h,w,3); skin/cloth/eyes masks 0..1"""
    h, w, _ = rgb.shape
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    n1 = noise(h, w, 5, seed)[..., None]            # big blotches
    n2 = noise(h, w, 20, seed + 1)[..., None]       # mottling
    n3 = noise(h, w, 3, seed + 4)[..., None]        # where the veins show
    veins = noise(h, w, 48, seed + 2, octaves=3)
    veins = np.clip(1 - np.abs(veins - 0.5) * 22, 0, 1)[..., None] * np.clip((n3 - 0.55) * 5, 0, 1)
    # --- dead skin: pale grey with a sick green-yellow cast, keeps the painted detail
    sk = skin > 0.5
    mean = float(np.mean(lum[sk])) if sk.any() else 0.5
    detail = np.clip(lum / max(1e-3, mean), 0.3, 1.6)
    tint = np.array([0.53, 0.56, 0.46], np.float32)
    dead = tint * detail * (0.85 + 0.3 * n1)
    blot = np.clip((n2 - 0.6) * 5, 0, 1)            # purple-brown bruising
    dead = dead * (1 - 0.4 * blot) + np.array([0.33, 0.24, 0.28], np.float32) * detail * 0.4 * blot
    rot = np.clip((0.3 - n1) * 6, 0, 1)             # greener rot in patches
    dead = dead * (1 - 0.35 * rot) + np.array([0.34, 0.40, 0.24], np.float32) * detail * 0.35 * rot
    dead = dead * (1 - 0.3 * veins) + np.array([0.22, 0.20, 0.28], np.float32) * 0.3 * veins
    s = skin[..., None]
    out = rgb * (1 - s) + dead * s
    # --- clothes: duller, dirtier
    c = cloth[..., None]
    dull = (rgb * 0.55 + lum * 0.45) * (0.6 + 0.4 * n2) * np.array([0.96, 0.92, 0.84], np.float32)
    dirt = np.clip((n1 - 0.55) * 4, 0, 1)
    dull = dull * (1 - 0.4 * dirt) + np.array([0.22, 0.17, 0.11], np.float32) * 0.4 * dirt
    out = out * (1 - c) + dull * c
    # --- blood: some splashes and smears, not everywhere
    body = np.clip(skin + cloth, 0, 1)
    blood = splats(h, w, int(h * w / 26000), seed + 3, h / 220, h / 70, body) * body
    fresh = np.array([0.32, 0.03, 0.03], np.float32); dried = np.array([0.17, 0.05, 0.04], np.float32)
    bc = fresh * (1 - n1) + dried * n1
    b = (blood * (0.5 + 0.5 * n2[..., 0]))[..., None] * 0.9
    out = out * (1 - b) + bc * b
    # --- dark, sunken, raw eye sockets
    if eyes is not None:
        e8 = Image.fromarray((eyes * 255).astype(np.uint8))
        ring = np.asarray(e8.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(5)), np.float32)[..., None] / 255
        rim = np.asarray(e8.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(8)), np.float32)[..., None] / 255
        out = out * (1 - 0.35 * rim) + np.array([0.30, 0.06, 0.06], np.float32) * 0.35 * rim
        out = out * (1 - 0.65 * ring) + np.array([0.06, 0.02, 0.02], np.float32) * 0.65 * ring
    # --- blood round the mouth and down the chin
    if mouth is not None:
        m8 = Image.fromarray((mouth * 255).astype(np.uint8))
        mb = np.asarray(m8.filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
        mb = np.clip(mb * (0.3 + 1.0 * n2), 0, 1)
        out = out * (1 - 0.85 * mb) + (fresh * 0.6 + dried * 0.4) * 0.85 * mb
    return np.clip(out, 0, 1)

def tri_mask(uvtris, h, w):
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    for t in uvtris:
        # UVs outside 0..1 wrap (the texture repeats)
        ox, oy = math.floor(min(t[0], t[2], t[4])), math.floor(min(t[1], t[3], t[5]))
        pts = [((t[i] - ox) * w, (1 - (t[i + 1] - oy)) * h) for i in (0, 2, 4)]
        d.polygon(pts, fill=255)
    im = im.filter(ImageFilter.MaxFilter(3))
    return np.asarray(im, np.float32) / 255

def process(id_):
    jpath = os.path.join(MODELS, id_ + '.json')
    meta = json.load(open(jpath))
    extra_path = os.path.join(MODELS, id_ + '.uv.json')
    extra = json.load(open(extra_path)) if os.path.exists(extra_path) else {}
    roles = {}
    for m in meta['meshes']:
        mat = m['material']
        if mat.get('map'): roles.setdefault(mat['map'], {'role': 'map', 'alpha': False, 'alphaMap': None, 'mats': []})
        r = roles.get(mat.get('map'))
        if r:
            r['mats'].append(mat['name'])
            if mat.get('alpha'): r['alpha'] = True; r['alphaMap'] = r['alphaMap'] or (mat.get('alphaMap') if mat.get('alphaMap') != mat.get('map') else None)
        if mat.get('normalMap'): roles.setdefault(mat['normalMap'], {'role': 'normal'})
    out_names = {}
    emissive = {}
    for k, (name, r) in enumerate(roles.items()):
        src = load(name)
        if r['role'] == 'normal':
            im = src.convert('RGB').resize((NORMAL_SIZE, NORMAL_SIZE), Image.LANCZOS)
            fn = f'{id_}_n{k}.webp'
            im.save(os.path.join(MODELS, fn), quality=80, method=6)
            out_names[name] = fn
            continue
        has_alpha = src.mode in ('RGBA', 'LA') or 'transparency' in src.info
        rgba = src.convert('RGBA')
        if r['alphaMap']:
            a = load(r['alphaMap']).convert('L').resize(rgba.size)
            rgba.putalpha(a)
        size = 512 if r['alpha'] and not any('body' in n.lower() for n in r['mats']) else SIZE
        im = rgba.resize((size, size), Image.LANCZOS)
        arr = np.asarray(im, np.float32) / 255
        rgb = arr[..., :3]
        # masks from the meshes' UVs (skin / clothes / eyes) for this texture
        masks = extra.get(name, {})
        H = im.size[0]
        skin = tri_mask(masks['skin'], H, H) if masks.get('skin') else np.zeros((H, H), np.float32)
        cloth = tri_mask(masks['cloth'], H, H) if masks.get('cloth') else np.zeros((H, H), np.float32)
        eyes = tri_mask(masks['eyes'], H, H) if masks.get('eyes') else None
        mouth = tri_mask(masks['mouth'], H, H) if masks.get('mouth') else None
        if id_ in PEOPLE:
            cloth = np.clip(cloth - skin, 0, 1)
            rgb = zombify(rgb, skin, cloth, eyes, mouth=mouth, seed=zlib.crc32((id_ + name).encode()) & 0xffff)
        elif eyes is not None:
            # already zombies: just darken round the eyes a touch
            ring = np.asarray(Image.fromarray((eyes * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
            rgb = rgb * (1 - 0.5 * ring) + np.array([0.06, 0.02, 0.02], np.float32) * 0.5 * ring
        if eyes is not None:
            # glowing green eyes: the eyeballs become emissive
            e = np.asarray(Image.fromarray((eyes * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
            em = np.zeros((H, H, 3), np.float32)
            em[..., 0] = 0.35 * e; em[..., 1] = 1.0 * e; em[..., 2] = 0.25 * e
            rgb = rgb * (1 - e[..., None]) + np.array([0.25, 0.9, 0.2], np.float32) * e[..., None]
            efn = f'{id_}_e{k}.webp'
            Image.fromarray((em * 255).astype(np.uint8)).resize((256, 256), Image.BILINEAR).save(os.path.join(MODELS, efn), quality=85)
            emissive[name] = efn
        out = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
        if r['alpha']:
            a = (arr[..., 3] * 255).astype(np.uint8)
            img = Image.fromarray(np.dstack([out, a]), 'RGBA')
        else:
            img = Image.fromarray(out, 'RGB')
        fn = f'{id_}_d{k}.webp'
        img.save(os.path.join(MODELS, fn), quality=82, method=6)
        out_names[name] = fn
    for m in meta['meshes']:
        mat = m['material']
        src = mat.get('map')
        mat['map'] = out_names.get(src)
        mat['emissiveMap'] = emissive.get(src)
        mat['normalMap'] = out_names.get(mat.get('normalMap'))
        mat.pop('alphaMap', None)
    meta['textures'] = sorted(set(out_names.values()) | set(emissive.values()))
    json.dump(meta, open(jpath, 'w'))
    print(id_, meta['textures'])

ids = [f[:-5] for f in sorted(os.listdir(MODELS)) if f.endswith('.json') and not f.endswith('.uv.json') and f != 'anims.json']
for i in ids:
    if not ONLY or i in ONLY:
        process(i)
