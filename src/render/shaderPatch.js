// =============================================================================
// Several features (photo surfaces, baked lighting) each patch the standard
// material's shader. A material only has one onBeforeCompile, so they register
// here and all run, in order.
// =============================================================================
export function addShaderPatch(mat, key, fn) {
  const list = mat.userData.shaderPatches || (mat.userData.shaderPatches = []);
  const old = list.findIndex((p) => p.key === key);
  if (old >= 0) list.splice(old, 1);
  list.push({ key, fn });
  mat.onBeforeCompile = (shader, renderer) => { for (const p of list) p.fn(shader, renderer); };
  mat.customProgramCacheKey = () => list.map((p) => p.key).join('|');
  mat.needsUpdate = true;
}
