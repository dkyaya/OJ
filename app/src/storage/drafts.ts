export type Draft={id:string;kind:string;data:Record<string,string>;updatedAt:string;publishedVersion?:string;sync:'draft'|'awaiting'|'published'|'outdated'|'conflict'};
const dbName='oj-drafts';const store='records';
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore(store,{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
export async function saveDraft(d:Draft){const db=await open();return new Promise<void>((resolve,reject)=>{const r=db.transaction(store,'readwrite').objectStore(store).put(d);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
export async function listDrafts(){const db=await open();return new Promise<Draft[]>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function clearDraft(id:string){const db=await open();return new Promise<void>((resolve,reject)=>{const r=db.transaction(store,'readwrite').objectStore(store).delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
