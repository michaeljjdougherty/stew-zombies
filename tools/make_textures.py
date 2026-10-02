#!/usr/bin/env python3
# Builds assets/tex/: photo detail + normal maps for the school's surfaces.
#
# Every source is a CC0 photo-scanned material from ambientCG (ambientcg.com),
# taken from two GitHub mirrors (ambientcg.com itself isn't reachable from the
# build machine):
#   - PatrickJnr/cc0-texture-pack   (Source 2 .vtex_c files; decoded by tools/vtex.py)
#   - amazingsammed/mini_textures   (1K JPGs: Asphalt033, Grass005, Ground111, Wood095, Metal063)
#
# "Detail" maps hold the photo's fine structure only: each one is divided by a
# blurred copy of itself (so big lighting gradients and tiling patches vanish)
# and normalised to an average of 1. The game multiplies its painted wall /
# floor colours by it (shader: colour *= detail * 4), so the paint, stripes and
# grime stay art-directed while the surface gets real brick, grain and flecks.
# Normal maps are converted to OpenGL convention with a full Z channel.
#
# Usage: python3 tools/make_textures.py <cc0-texture-pack dir> <mini_textures/textures dir>
import sys, os, glob, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from vtex import read as read_vtex

PACK, MINI = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)

# name: (source, mode, contrast, out size, blur fraction, rotate90)
#   source 'pack:bricks038' or 'mini:Wood095'; mode 'gray' (detail only) or 'color'
SURF = {
  'block':     ('pack:bricks038',       'gray',  1.0, 1024, 0.10, False),  # painted cinder block
  'blockRaw':  ('pack:bricks064',       'gray',  1.0, 1024, 0.10, False),  # bare concrete block
  'brick':     ('pack:bricks059',       'color', 1.0, 1024, 0.12, False),  # exterior red brick
  'plaster':   ('pack:paintedplaster017', 'gray', 1.6, 1024, 0.08, False), # smooth painted plaster
  'tileWall':  ('pack:tiles105',        'gray',  1.0, 1024, 0.10, False),  # small glazed wall tiles
  'gymFloor':  ('pack:woodfloor045',    'color', 2.0, 1024, 0.10, False),  # maple strip floor
  'woodFloor': ('pack:woodfloor042',    'color', 1.0, 1024, 0.12, False),  # stage / band room planks
  'vct':       ('pack:terrazzo005',     'gray',  0.22, 1024, 0.08, False), # speckled vinyl tile
  'tileFloor': ('pack:tiles036',        'gray',  1.0, 1024, 0.10, False),  # cafeteria floor tiles
  'concrete':  ('pack:concrete020',     'gray',  1.2, 1024, 0.08, False),
  'ceiling':   ('pack:officeceiling001', 'gray', 1.0, 1024, 0.10, False),  # acoustic ceiling tiles
  'carpet':    ('pack:carpet012',       'gray',  1.4, 512,  0.10, False),
  'asphalt':   ('mini:Asphalt033',      'gray',  1.2, 1024, 0.08, False),
  'grass':     ('mini:Grass005',        'color', 1.0, 1024, 0.10, False),
  'ground':    ('mini:Ground111',       'color', 1.0, 1024, 0.10, False),
  'wood':      ('mini:Wood095',         'gray',  2.2, 512,  0.10, False),
  'panel':     ('mini:Wood095',         'gray',  1.8, 512,  0.10, True),   # vertical-grain paneling
  'metal':     ('mini:Metal063',        'gray',  1.0, 512,  0.10, False),
}

def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def blur(a, sigma):
    # Gaussian blur with wrap-around (the photos tile), via FFT
    h, w = a.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))
    if a.ndim == 3: return np.stack([np.real(np.fft.ifft2(np.fft.fft2(a[..., k]) * g)) for k in range(a.shape[2])], -1)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))

def load(src, kind):
    lib, name = src.split(':')
    if lib == 'pack':
        f = glob.glob(os.path.join(PACK, 'textures', '*', f'{name}_{kind}_*.vtex_c'))
        if not f: raise FileNotFoundError(src + ' ' + kind)
        im, info = read_vtex(sorted(f)[0], 1024)
        return im.convert('RGB'), 'dx'
    return Image.open(os.path.join(MINI, f'{name}_{"diffuse" if kind == "color" else kind}.jpg')).convert('RGB'), 'gl'

means = {}
for key, (src, mode, contrast, size, bf, rot) in SURF.items():
    col, _ = load(src, 'color')
    nor, conv = load(src, 'normal')
    col = col.resize((size, size * col.height // col.width), Image.LANCZOS)
    nor = nor.resize(col.size, Image.LANCZOS)
    c = srgb_to_lin(np.asarray(col).astype(np.float64) / 255)
    means[key] = [round(float(v), 4) for v in (np.asarray(col).reshape(-1, 3).mean(0) / 255)]
    if mode == 'gray': c = (c @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
    low = blur(c, bf * size)
    r = c / np.maximum(low, 1e-4)
    r = r / r.reshape(-1, r.shape[-1]).mean(0)
    r = np.power(np.maximum(r, 1e-4), contrast)
    r = r / r.reshape(-1, r.shape[-1]).mean(0)
    d = np.clip(r / 4 * 255 + 0.5, 0, 255).astype(np.uint8)
    n = np.asarray(nor).astype(np.float64) / 255 * 2 - 1
    x, y = n[..., 0], n[..., 1]
    if conv == 'dx': y = -y
    z = np.sqrt(np.clip(1 - x * x - y * y, 0, 1))
    nn = np.stack([x, y, z], -1); nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    if rot:
        d = np.rot90(d, 1)
        nn = np.rot90(nn, 1); nn = np.stack([-nn[..., 1], nn[..., 0], nn[..., 2]], -1)
    dimg = Image.fromarray(d[..., 0] if d.shape[-1] == 1 else d, 'L' if d.shape[-1] == 1 else 'RGB')
    dimg.save(os.path.join(OUT, f'{key}_d.jpg'), quality=86, optimize=True)
    nimg = Image.fromarray(np.clip((nn * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB')
    nimg.save(os.path.join(OUT, f'{key}_n.jpg'), quality=88, optimize=True)
    print(f'{key:10s} {src:26s} {dimg.size} mean sRGB {means[key]}')
json.dump(means, open(os.path.join(OUT, 'means.json'), 'w'), indent=1)
