import { Registry } from '../core/registry.ts';
import { RouteRegistry } from '../core/router.ts';
import { createModuleRuntime, type ModuleRuntime } from '../core/modules.ts';
import type { BackendContributions, BackendModule } from '../contracts/contributions.ts';
import { module as gateway } from '../modules/gateway/public/module.ts';
import { module as upstream } from '../modules/upstream/public/module.ts';
import { module as providers } from '../modules/providers/public/module.ts';
import { module as chat } from '../modules/chat/public/module.ts';

/** 必需模块不可关闭；可选模块经 CLAWBOX_DISABLED_MODULES/DISABLED_MODULES 排除。 */
const REQUIRED_MODULE_IDS = ['gateway', 'upstream', 'chat'];

const builtins: readonly BackendModule[] = [
  gateway,
  upstream,
  providers,
  chat
];

export interface Composition {
  contributions: BackendContributions;
  runtime: ModuleRuntime<BackendContributions>;
}

export function createComposition(config: BackendContributions['config']): Composition {
  for (const id of config.disabledModules) {
    if (!builtins.some((candidate) => candidate.id === id)) throw new Error(`Unknown disabled module: ${id}`);
    if (REQUIRED_MODULE_IDS.includes(id)) throw new Error(`Required module cannot be disabled: ${id}`);
  }
  const contributions: BackendContributions = {
    config,
    routes: new RouteRegistry(),
    services: new Registry()
  };
  const modules = builtins.filter((candidate) => !config.disabledModules.includes(candidate.id));
  const runtime = createModuleRuntime(modules, contributions);
  return { contributions, runtime };
}
