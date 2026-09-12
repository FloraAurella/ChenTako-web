export class EventBus<Events extends object = Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();
  on<K extends keyof Events>(name: K, listener: (payload: Events[K]) => void) {
    const set = this.listeners.get(name) || new Set();
    set.add(listener as (payload: never) => void); this.listeners.set(name, set);
    return () => { set.delete(listener as (payload: never) => void); if (!set.size) this.listeners.delete(name); };
  }
  emit<K extends keyof Events>(name: K, payload: Events[K]) {
    const errors: unknown[] = [];
    for (const listener of [...(this.listeners.get(name) || [])]) {
      try { listener(payload as never); } catch (error) { errors.push(error); }
    }
    if (errors.length) console.error('[EventBus] listener failure', new AggregateError(errors));
  }
  clear() { this.listeners.clear(); }
}
