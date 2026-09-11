import type { FrontendModule } from '../../contracts/contributions';
import { createExtensionSettingsService } from './services/extension-service';
import { ExtensionsPane } from './ui/ExtensionsPane';
export const module: FrontendModule = {
 id: 'extensions', setup({ services, scope }) {
  scope.defer(services.domains.register('extensions', { id: 'extensions', create: createExtensionSettingsService,
reset: (bridge, route) => { if (!(route?.name === 'settings' && ['tools','skills'].includes(route.settingsSection)) && bridge.get().extensionEditing) bridge.patch({extensionEditing:null}); },
}));
scope.defer(services.settings.register('extensions', { id:'tools', label:"工具", icon:'puzzle', description:"运行能力与自定义工具", search:[{"id": "", "title": "工具管理", "keywords": "tool 沙箱 代码解释器 schema"}], component: p => <ExtensionsPane {...p} kind="tool" /> }));
scope.defer(services.settings.register('extensions', { id:'skills', label:"技能", icon:'spark', description:"导入与启停", search:[{"id": "", "title": "技能管理", "keywords": "skill 导入 启用"}], component: p => <ExtensionsPane {...p} kind="skill" /> }));
}};
