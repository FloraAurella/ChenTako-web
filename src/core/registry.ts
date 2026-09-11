/** Owner-bound contributions. A failed/removed module cannot leave orphan registrations. */
export class Registry<T extends { id: string }> {
  private entries = new Map<string, { owner: string; value: T }>();
  register(owner: string, value: T) {
    if (!value.id || this.entries.has(value.id)) throw new Error(`Duplicate or empty contribution: ${value.id}`);
    const entry = { owner, value }; this.entries.set(value.id, entry);
    return () => { if (this.entries.get(value.id) === entry) this.entries.delete(value.id); };
  }
  get(id: string) { return this.entries.get(id)?.value; }
  list() { return [...this.entries.values()].map(entry => entry.value); }
  removeOwner(owner: string) { for (const [id, entry] of this.entries) if (entry.owner === owner) this.entries.delete(id); }
}
