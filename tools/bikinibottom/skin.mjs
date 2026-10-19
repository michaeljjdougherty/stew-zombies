// Shared by tools/bikinibottom/build.mjs and cast.mjs: a skinned mesh as it
// stands, its joints' pose baked into the vertices (the game draws it rigid).
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function bakeSkins(d) {
  const r = d.getRoot(), scene = r.listScenes()[0];
  for (const n of r.listNodes()) {
    const skin = n.getSkin(), mesh = n.getMesh(); if (!skin || !mesh) continue;
    const ibm = skin.getInverseBindMatrices();
    const JM = skin.listJoints().map((j, i) => mul(j.getWorldMatrix(), ibm ? ibm.getElement(i, []) : ID));
    for (const p of mesh.listPrimitives()) {
      const J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0');
      for (const sem of ['POSITION', 'NORMAL']) {
        const A = p.getAttribute(sem); if (!A) continue;
        const B = A.clone(), v = [], j = [], w = [], w4 = sem === 'POSITION' ? 1 : 0;
        for (let i = 0; i < A.getCount(); i++) {
          A.getElement(i, v); J.getElement(i, j); W.getElement(i, w);
          const o = [0, 0, 0];
          for (let q = 0; q < 4; q++) { if (!w[q]) continue; const m = JM[j[q]]; for (let e = 0; e < 3; e++) o[e] += w[q] * (m[e] * v[0] + m[4 + e] * v[1] + m[8 + e] * v[2] + m[12 + e] * w4); }
          if (!w4) { const l = Math.hypot(...o) || 1; o[0] /= l; o[1] /= l; o[2] /= l; }
          B.setElement(i, o);
        }
        p.setAttribute(sem, B);
      }
      p.setAttribute('JOINTS_0', null).setAttribute('WEIGHTS_0', null);
    }
    n.setSkin(null);
    const par = n.getParentNode(); if (par) par.removeChild(n);
    n.setMatrix(ID); scene.addChild(n);
  }
}
