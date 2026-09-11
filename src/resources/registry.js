/** Deterministic layered resources. Registration is trusted source code; imported user themes
 * continue through the appearance module's validated data-only theme package parser. */
export function createResourceRegistry() {
 const entries = new Map(); const rank = {system:0,module:1,user:2};
 return {
  register({id, owner, layer = 'module', value}) {
   if (!id || !owner || !(layer in rank)) throw new Error('Invalid resource registration');
   if (layer === 'user' && !id.startsWith('theme/')) throw new Error('User resources must be validated theme data');
   const key = `${layer}:${owner}:${id}`;
   if (entries.has(key)) throw new Error(`Duplicate resource: ${key}`);
   const entry = {id,owner,layer,value}; entries.set(key,entry);
   return () => { if (entries.get(key) === entry) entries.delete(key); };
  },
  resolve(id, fallback) {
   const candidates = [...entries.values()].filter(entry => entry.id === id);
   candidates.sort((a,b) => rank[b.layer] - rank[a.layer]);
   return candidates[0]?.value ?? fallback;
  },
  list() {return [...entries.values()];},
  removeOwner(owner) { for (const [key,entry] of entries) if (entry.owner === owner) entries.delete(key); },
 };
}
export const resources = createResourceRegistry();
export function registerSystem(kind, values) {
 for (const [name,value] of Object.entries(values)) resources.register({id:`${kind}/${name}`,owner:'system',layer:'system',value});
}
