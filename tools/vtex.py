# Minimal Source 2 .vtex_c reader: DXT1/DXT5/RGBA8888/BC7?, LZ4-compressed mips. Returns a PIL image of a chosen mip.
import struct, sys, numpy as np
from PIL import Image

def lz4_block(src, out_size):
    dst = bytearray(); i = 0; n = len(src)
    while i < n:
        tok = src[i]; i += 1
        lit = tok >> 4
        if lit == 15:
            while True:
                b = src[i]; i += 1; lit += b
                if b != 255: break
        dst += src[i:i+lit]; i += lit
        if i >= n: break
        off = src[i] | (src[i+1] << 8); i += 2
        ml = tok & 15
        if ml == 15:
            while True:
                b = src[i]; i += 1; ml += b
                if b != 255: break
        ml += 4
        start = len(dst) - off
        if off >= ml: dst += dst[start:start+ml]
        else:
            for k in range(ml): dst.append(dst[start+k])
    assert len(dst) == out_size, (len(dst), out_size)
    return bytes(dst)

def rgb565(c):
    r = ((c >> 11) & 31) * 255 // 31; g = ((c >> 5) & 63) * 255 // 63; b = (c & 31) * 255 // 31
    return np.stack([r, g, b], -1).astype(np.int32)

def dxt1_colors(c0, c1, alpha_mode):
    p0 = rgb565(c0); p1 = rgb565(c1)
    gt = (c0 > c1)[:, None]
    p2 = np.where(gt, (2 * p0 + p1) // 3, (p0 + p1) // 2)
    p3 = np.where(gt, (p0 + 2 * p1) // 3, 0 if alpha_mode else 0)
    return np.stack([p0, p1, p2, p3], 1)  # (N,4,3)

def decode_dxt(data, w, h, fmt):
    bw, bh = max(1, w // 4), max(1, h // 4)
    bs = 8 if fmt == 1 else 16
    a = np.frombuffer(data[:bw * bh * bs], dtype=np.uint8).reshape(-1, bs)
    col = a[:, bs - 8:]
    c0 = col[:, 0].astype(np.int32) | (col[:, 1].astype(np.int32) << 8)
    c1 = col[:, 2].astype(np.int32) | (col[:, 3].astype(np.int32) << 8)
    pal = dxt1_colors(c0, c1, fmt == 1)
    if fmt != 1:  # DXT5: colour always 4-colour mode
        p0 = rgb565(c0); p1 = rgb565(c1)
        pal = np.stack([p0, p1, (2 * p0 + p1) // 3, (p0 + 2 * p1) // 3], 1)
    idx = col[:, 4:8].astype(np.uint32)
    bits = idx[:, 0] | (idx[:, 1] << 8) | (idx[:, 2] << 16) | (idx[:, 3] << 24)
    sel = np.stack([(bits >> (2 * k)) & 3 for k in range(16)], 1)  # (N,16)
    px = np.take_along_axis(pal, sel[:, :, None].astype(np.int64).repeat(3, 2), 1)  # (N,16,3)
    out = np.ones((bw * bh, 16, 4), np.uint8) * 255
    out[:, :, :3] = px
    if fmt == 2:
        al = a[:, :8]
        a0 = al[:, 0].astype(np.int32); a1 = al[:, 1].astype(np.int32)
        ab = np.zeros(len(al), np.uint64)
        for k in range(6): ab |= al[:, 2 + k].astype(np.uint64) << np.uint64(8 * k)
        asel = np.stack([((ab >> np.uint64(3 * k)) & np.uint64(7)).astype(np.int32) for k in range(16)], 1)
        tab = np.zeros((len(al), 8), np.int32); tab[:, 0] = a0; tab[:, 1] = a1
        gt = a0 > a1
        for k in range(2, 8):
            tab[:, k] = np.where(gt, ((8 - k) * a0 + (k - 1) * a1) // 7, 0)
        for k in range(2, 6):
            tab[:, k] = np.where(gt, tab[:, k], ((6 - k) * a0 + (k - 1) * a1) // 5)
        tab[:, 6] = np.where(gt, tab[:, 6], 0); tab[:, 7] = np.where(gt, tab[:, 7], 255)
        out[:, :, 3] = np.take_along_axis(tab, asel, 1)
    img = out.reshape(bh, bw, 4, 4, 4).transpose(0, 2, 1, 3, 4).reshape(bh * 4, bw * 4, 4)
    return img

def read(path, want=1024):
    d = open(path, 'rb').read()
    rsize, hv, ver, boff, bcount = struct.unpack_from('<IHHII', d, 0)
    base = 8 + boff; data_off = None
    for i in range(bcount):
        o = base + i * 12
        if d[o:o+4] == b'DATA': data_off = o + 4 + struct.unpack_from('<I', d, o + 4)[0]
    o = data_off
    w, h, dep = struct.unpack_from('<HHH', d, o + 20); fmt, mips = struct.unpack_from('<BB', d, o + 26)
    eoff, ecnt = struct.unpack_from('<II', d, o + 32)
    eo = o + 32 + eoff; comp = None
    for i in range(ecnt):
        t, off, size = struct.unpack_from('<III', d, eo + i * 12)
        ab = eo + i * 12 + 4 + off
        if t == 4:
            c1, moff, n = struct.unpack_from('<III', d, ab)
            if c1 == 1: comp = list(struct.unpack_from('<%di' % n, d, ab + 4 + moff))
    bpb = {1: 8, 2: 16, 20: 16}.get(fmt)
    def mipsize(m):
        mw, mh = max(1, w >> m), max(1, h >> m)
        if bpb: return max(1, (mw + 3) // 4) * max(1, (mh + 3) // 4) * bpb
        if fmt == 4: return mw * mh * 4
        raise ValueError('format %d' % fmt)
    pos = rsize
    target = 0
    while (w >> target) > want and target < mips - 1: target += 1
    for m in range(mips - 1, -1, -1):  # smallest first
        csize = comp[m] if comp else mipsize(m)
        if m == target:
            raw = d[pos:pos + csize]
            if comp and csize < mipsize(m): raw = lz4_block(raw, mipsize(m))
            mw, mh = max(1, w >> m), max(1, h >> m)
            if bpb:
                im = Image.frombytes('RGBA', (max(4, mw), max(4, mh)), raw, 'bcn', {1: 1, 2: 3, 20: 7}[fmt])
                return im, (w, h, fmt)
            img = np.frombuffer(raw, np.uint8).reshape(mh, mw, 4)
            return Image.fromarray(img, 'RGBA'), (w, h, fmt)
        pos += csize

if __name__ == '__main__':
    im, info = read(sys.argv[1], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
    print(info, im.size)
    im.convert('RGB').save(sys.argv[2], quality=90)
