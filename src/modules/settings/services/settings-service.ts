import { createSettingsStateBridge, type SettingsDependencies } from '../../../contracts/settings';
import type { SettingsDomain } from '../../../contracts/contributions';
/** Composition is injected. Each owner supplies its own service and navigation policy. */
export function createSettingsService(dependencies: SettingsDependencies, domains: readonly SettingsDomain[]) {
 const state = createSettingsStateBridge();
 const instances: Record<string, any> = Object.fromEntries(domains.map(domain => [domain.id, domain.create(dependencies, state)]));
 return {
  ...instances, theme: dependencies.theme, state,
  hasUnsavedChanges() { return domains.some(domain => domain.hasUnsaved?.(state)); },
  resetNavigationState(route?: any) { for (const domain of domains) domain.reset?.(state, route); },
  async beforeNavigate(target: any) { for (const domain of domains) if (domain.canLeave && !await domain.canLeave(instances[domain.id], target)) return false; return true; },
 } as { [key: string]: any; theme:any; state:typeof state; hasUnsavedChanges():boolean; resetNavigationState(route?:any):void; beforeNavigate(target:any):Promise<boolean> };
}
export type SettingsService = ReturnType<typeof createSettingsService>;
