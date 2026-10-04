import json,struct,numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
  b=open(p,'rb').read(); cl=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+cl])
  off=20+cl; bl=struct.unpack('<I',b[off:off+4])[0]; bin_=b[off+8:off+8+bl]; return j,bin_
def acc(j,bin_,i):
  a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; dt=CT[a['componentType']]; n=NC[a['type']]
  o=bv.get('byteOffset',0)+a.get('byteOffset',0); stride=bv.get('byteStride',0); isz=np.dtype(dt).itemsize*n
  if stride and stride!=isz:
    raw=np.frombuffer(bin_,np.uint8,count=stride*(a['count']-1)+isz,offset=o)
    arr=np.lib.stride_tricks.as_strided(raw,shape=(a['count'],isz),strides=(stride,1)).copy().view(dt).reshape(a['count'],n)
  else: arr=np.frombuffer(bin_,dt,count=a['count']*n,offset=o).reshape(a['count'],n)
  arr=arr.astype(np.float32) if dt==np.float32 else arr
  if a.get('normalized'):
    m={np.uint8:255,np.int8:127,np.uint16:65535,np.int16:32767}[dt]; arr=np.maximum(arr.astype(np.float32)/m,-1)
  return arr
def qmat(q):
  x,y,z,w=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def local(n):
  if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
  M=np.eye(4); s=n.get('scale',[1,1,1]); r=n.get('rotation',[0,0,0,1]); t=n.get('translation',[0,0,0])
  M[:3,:3]=qmat(r)*np.array(s); M[:3,3]=t; return M
def world_mats(j):
  W={}; par={}
  for i,n in enumerate(j['nodes']):
    for c in n.get('children',[]): par[c]=i
  def get(i):
    if i in W: return W[i]
    M=local(j['nodes'][i]); W[i]=(get(par[i])@M) if i in par else M; return W[i]
  for i in range(len(j['nodes'])): get(i)
  return W
def meshes(j,bin_):
  """yield (nodeIndex, primitive dict, world matrix, attrs dict, indices)"""
  W=world_mats(j)
  for i,n in enumerate(j['nodes']):
    if 'mesh' not in n: continue
    for pr in j['meshes'][n['mesh']]['primitives']:
      at={k:acc(j,bin_,v) for k,v in pr['attributes'].items()}
      idx=acc(j,bin_,pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(at['POSITION']))
      yield i,pr,W[i],at,idx
def image_bytes(j,bin_,k):
  im=j['images'][k]; bv=j['bufferViews'][im['bufferView']]; o=bv.get('byteOffset',0)
  return bin_[o:o+bv['byteLength']], im.get('mimeType')
