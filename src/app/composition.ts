import { module as commands } from '../modules/commands/public/module';
import { Registry } from '../core/registry';
import { createModuleRuntime } from '../core/modules';
import type { FrontendContributions, FrontendModule } from '../contracts/contributions';
import { module as appearance } from '../modules/appearance/public/module';
import { module as connections } from '../modules/connections/public/module';
import { module as context } from '../modules/context/public/module';
import { module as extensions } from '../modules/extensions/public/module';
import { module as data } from '../modules/data/public/module';
import { module as projects } from '../modules/projects/public/module';
import { module as settings } from '../modules/settings/public/module';
import { module as chat } from '../modules/chat/public/module';
import { createSettingsService as composeSettings } from '../modules/settings/public/services_settings-service';
import type { SettingsDependencies } from '../contracts/settings';
export const builtins: readonly FrontendModule[] = [appearance,connections,context,extensions,data,projects,commands,chat,settings];
/** Source composition: optional modules are excluded before startup, never hot unloaded. */
export function createComposition(disabled: readonly string[] = []) {
 for (const id of ['commands','chat','appearance','connections','context','projects','settings']) if (disabled.includes(id)) throw new Error(`Required module cannot be disabled: ${id}`);
 for (const id of disabled) if (!builtins.some(m => m.id === id)) throw new Error(`Unknown disabled module: ${id}`);
 const contributions: FrontendContributions = { commands:new Registry(),settings:new Registry(),domains:new Registry(),pages:new Registry(),controllers:new Registry(),slots:new Registry() };
 const runtime = createModuleRuntime(builtins.filter(m => !disabled.includes(m.id)), contributions);
 runtime.start();
 return { contributions,runtime, createSettingsService:(deps:SettingsDependencies) => composeSettings(deps,contributions.domains.list()), dispose:runtime.dispose };
}

