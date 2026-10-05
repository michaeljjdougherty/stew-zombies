# Minimal reader for Blender 2.8-3.x .blend files: pulls out every mesh object
# (world-space positions, UVs, triangles) without needing Blender. Enough for
# simple props; ignores modifiers. Usage: from blend import read_meshes
import struct, numpy as np

class Blend:
    def __init__(self, path):
        d = self.d = open(path, 'rb').read()
        assert d[:7] == b'BLENDER', 'not a .blend (compressed files must be saved uncompressed)'
        self.ps = 8 if d[7:8] == b'-' else 4
        self.e = '<' if d[8:9] == b'v' else '>'
        off = 12; self.blocks = []; self.by_addr = {}
        hs = 16 + self.ps
        while off < len(d):
            code = d[off:off + 4]
            size, = struct.unpack(self.e + 'i', d[off + 4:off + 8])
            addr = int.from_bytes(d[off + 8:off + 8 + self.ps], 'little' if self.e == '<' else 'big')
            sdna, count = struct.unpack(self.e + 'ii', d[off + 8 + self.ps:off + hs])
            b = (code, size, addr, sdna, count, off + hs)
            self.blocks.append(b); self.by_addr[addr] = b
            if code == b'ENDB': break
            if code == b'DNA1': self.parse_dna(off + hs)
            off += hs + size
    def parse_dna(self, p):
        d, e = self.d, self.e
        def align(q): return (q + 3) & ~3
        assert d[p:p + 4] == b'SDNA'; p += 4
        assert d[p:p + 4] == b'NAME'; p += 4
        n, = struct.unpack(e + 'i', d[p:p + 4]); p += 4
        names = []
        for _ in range(n):
            q = d.index(b'\0', p); names.append(d[p:q].decode()); p = q + 1
        p = align(p); assert d[p:p + 4] == b'TYPE'; p += 4
        n, = struct.unpack(e + 'i', d[p:p + 4]); p += 4
        types = []
        for _ in range(n):
            q = d.index(b'\0', p); types.append(d[p:q].decode()); p = q + 1
        p = align(p); assert d[p:p + 4] == b'TLEN'; p += 4
        tlen = list(struct.unpack(e + '%dh' % len(types), d[p:p + 2 * len(types)])); p += 2 * len(types)
        p = align(p); assert d[p:p + 4] == b'STRC'; p += 4
        n, = struct.unpack(e + 'i', d[p:p + 4]); p += 4
        self.structs = {}; self.struct_list = []
        for _ in range(n):
            t, nf = struct.unpack(e + 'hh', d[p:p + 4]); p += 4
            fields = {}; o = 0
            for _ in range(nf):
                ft, fn = struct.unpack(e + 'hh', d[p:p + 4]); p += 4
                name = names[fn]
                if name.startswith('*') or name.startswith('(*'): sz = self.ps
                else: sz = tlen[ft]
                arr = 1
                for part in name.split('[')[1:]: arr *= int(part.rstrip(']'))
                base = name.split('[')[0].lstrip('*').strip('()*')
                fields[base] = (o, types[ft], name, sz)
                o += sz * arr
            self.structs[types[t]] = fields; self.struct_list.append(types[t])
    def fld(self, off, st, name, fmt=None):
        o, t, n, sz = self.structs[st][name]
        if n.startswith('*'):
            return int.from_bytes(self.d[off + o:off + o + self.ps], 'little' if self.e == '<' else 'big')
        return struct.unpack(self.e + fmt, self.d[off + o:off + o + struct.calcsize(fmt)]) if fmt else off + o
    def blocks_of(self, st):
        i = self.struct_list.index(st)
        return [b for b in self.blocks if b[3] == i and b[0] not in (b'DNA1',)]
    def deref(self, addr): return self.by_addr.get(addr)

def read_meshes(path):
    B = Blend(path)
    out = []
    for code, size, addr, sdna, count, off in B.blocks:
        if code[:2] != b'OB': continue
        data = B.fld(off, 'Object', 'data')
        mb = B.deref(data)
        if not mb or B.struct_list[mb[3]] != 'Mesh': continue
        M = B.fld(off, 'Object', 'obmat', '16f'); M = np.array(M).reshape(4, 4).T   # column-major
        name = B.d[B.fld(off, 'Object', 'id') + B.structs['ID']['name'][0]:][:66].split(b'\0')[0].decode(errors='ignore')
        mo = mb[5]
        totvert, = B.fld(mo, 'Mesh', 'totvert', 'i')
        mv = B.deref(B.fld(mo, 'Mesh', 'mvert'))
        if mv:
            ms = B.structs['MVert']; vsz = sum(f[3] * (eval('*'.join([x.rstrip(']') for x in f[2].split('[')[1:]]) or '1')) for f in ms.values())
            raw = np.frombuffer(B.d, np.uint8, count=totvert * vsz, offset=mv[5]).reshape(totvert, vsz)
            P = raw[:, :12].copy().view(np.float32).reshape(-1, 3)
        else:
            raise RuntimeError('mesh stores positions as attributes (Blender 3.5+): not supported')
        totpoly, = B.fld(mo, 'Mesh', 'totpoly', 'i'); totloop, = B.fld(mo, 'Mesh', 'totloop', 'i')
        mp = B.deref(B.fld(mo, 'Mesh', 'mpoly')); ml = B.deref(B.fld(mo, 'Mesh', 'mloop'))
        polys = np.frombuffer(B.d, np.int32, count=totpoly * 3, offset=mp[5]).reshape(totpoly, 3)   # loopstart, totloop, (mat_nr,flag)
        loops = np.frombuffer(B.d, np.uint32, count=totloop * 2, offset=ml[5]).reshape(totloop, 2)[:, 0]
        uvb = B.deref(B.fld(mo, 'Mesh', 'mloopuv'))
        UV = np.frombuffer(B.d, np.float32, count=totloop * 3, offset=uvb[5]).reshape(totloop, 3)[:, :2].copy() if uvb else None
        tris = []
        for ls, n, _ in polys:
            for k in range(1, n - 1): tris.append((ls, ls + k, ls + k + 1))
        tris = np.array(tris, np.int64)
        # split per loop (so UV seams stay sharp)
        LP = P[loops]
        LP = LP @ M[:3, :3].T + M[:3, 3]
        out.append({'name': name, 'P': LP, 'U': UV, 'I': tris})
    return out
