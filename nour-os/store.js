// Phone-only storage in IndexedDB. Code updates never touch this data; migrate() upgrades old shapes in place.
const DB_NAME = 'nour-os', DB_VER = 1;
let dbp = null;
function db(){
  if(dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if(!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', {keyPath:'id'});
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(store, mode, fn){
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
  }));
}
export const kvGet = k => tx('kv','readonly', s => s.get(k));
export const kvSet = (k, v) => tx('kv','readwrite', s => s.put(v, k));
export const photoPut = p => tx('photos','readwrite', s => s.put(p));
export const photoDel = id => tx('photos','readwrite', s => s.delete(id));
export const photoAll = () => tx('photos','readonly', s => s.getAll());
export const photoClear = () => tx('photos','readwrite', s => s.clear());

export async function persist(){
  try{ if(navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); }catch(e){}
  return false;
}

let timer = null;
export function saveState(state){
  clearTimeout(timer);
  timer = setTimeout(() => { kvSet('state', JSON.parse(JSON.stringify(state))).catch(()=>{}); }, 250);
}
export function saveNow(state){ clearTimeout(timer); return kvSet('state', JSON.parse(JSON.stringify(state))); }
