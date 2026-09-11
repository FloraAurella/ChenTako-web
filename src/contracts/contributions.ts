import type { RequestContextContribution } from './request-context';
import type { CommandContribution } from './commands';
import type { ComponentType } from 'react';
import type { SettingsDependencies, SettingsStateBridge } from './settings';
import type { Registry } from '../core/registry';
import type { ModuleDefinition } from '../core/modules';

export interface SettingsPaneProps {
  store: any; service: any; state: any; route: any; active: boolean;
}
export interface SettingsContribution {
  id: string; label: string; icon: string; description: string;
  component: ComponentType<SettingsPaneProps>;
  search: readonly { id: string; title: string; keywords: string }[];
}
export interface SettingsDomain {
  id: string;
  create(dependencies: SettingsDependencies, bridge: SettingsStateBridge): any;
  canLeave?(service: any, target: any): Promise<boolean>;
  hasUnsaved?(bridge: SettingsStateBridge): boolean;
  reset?(bridge: SettingsStateBridge, route: any): void;
}
export interface PageContribution {
  id: string; label: string; icon: string;
  component: ComponentType<{ store: any; active: boolean; settings: any; route: any }>;
}
export interface ControllerContribution {
  id: string;
  create(dependencies: any): any;
}
export interface SlotContribution {
  id: string; slot: 'composer.before' | 'composer.actions';
  component: ComponentType<{ store: any }>;
}
export interface FrontendContributions {
  requestContexts: Registry<RequestContextContribution>;
  commands: Registry<CommandContribution>;
  settings: Registry<SettingsContribution>;
  domains: Registry<SettingsDomain>;
  pages: Registry<PageContribution>;
  controllers: Registry<ControllerContribution>;
  slots: Registry<SlotContribution>;
}
export type FrontendModule = ModuleDefinition<FrontendContributions>;
