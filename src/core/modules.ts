import { Scope } from './scope';
import { EventBus } from './events';

export interface ModuleContext<Services> {
  services: Services;
  scope: Scope;
  events: EventBus;
}
export interface ModuleDefinition<Services> {
  id: string;
  dependsOn?: readonly string[];
  setup(context: ModuleContext<Services>): void | (() => void);
}

export function resolveModules<S>(modules: readonly ModuleDefinition<S>[]) {
  const map = new Map<string, ModuleDefinition<S>>();
  for (const module of modules) {
    if (!module.id || map.has(module.id)) throw new Error(`Duplicate or empty module: ${module.id}`);
    map.set(module.id, module);
  }
  const done = new Set<string>(); const visiting = new Set<string>(); const ordered: ModuleDefinition<S>[] = [];
  function visit(id: string) {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular module dependency: ${[...visiting, id].join(' → ')}`);
    const module = map.get(id); if (!module) throw new Error(`Missing module dependency: ${id}`);
    visiting.add(id); for (const dependency of module.dependsOn || []) visit(dependency);
    visiting.delete(id); done.add(id); ordered.push(module);
  }
  for (const module of modules) visit(module.id);
  return ordered;
}

export function createModuleRuntime<S>(modules: readonly ModuleDefinition<S>[], services: S) {
  const ordered = resolveModules(modules); const events = new EventBus(); const active: Scope[] = [];
  let started = false;
  function dispose() {
    const errors: unknown[] = [];
    for (const scope of active.splice(0).reverse()) { try { scope.dispose(); } catch (error) { errors.push(error); } }
    events.clear(); started = false;
    if (errors.length) throw new AggregateError(errors, 'Module teardown failed');
  }
  return {
    events,
    ids: ordered.map(module => module.id),
    start() {
      if (started) return;
      try {
        for (const module of ordered) {
          const scope = new Scope(); active.push(scope);
          const cleanup = module.setup({ services, scope, events });
          if (cleanup) scope.defer(cleanup);
          events.emit('module.started', { id: module.id });
        }
        started = true;
      } catch (error) { try { dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Module startup and rollback failed'); } throw error; }
    },
    dispose,
  };
}
