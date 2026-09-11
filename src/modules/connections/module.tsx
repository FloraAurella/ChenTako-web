import type { FrontendModule } from '../../contracts/contributions';
import { createProviderSettingsService } from './services/provider-service';
import { ProvidersPane } from './ui/ProvidersPane';
export const module: FrontendModule = {
 id: 'connections', setup({ services, scope }) {
  scope.defer(services.domains.register('connections', { id: 'providers', create: createProviderSettingsService,
hasUnsaved: bridge => Boolean(bridge.get().providerEditing?.dirty || bridge.get().providerEditing?.modelEditing),
canLeave: (service, target) => service.beforeNavigate(target),
reset: (bridge, route) => { if (!(route?.name === 'settings' && route.settingsSection === 'providers' && route.settingsProviderId) && bridge.get().providerEditing) bridge.patch({providerEditing:null}); },
}));
scope.defer(services.settings.register('connections', { id:'providers', label:"模型与供应商", icon:'key', description:"连接、模型与额度", search:[{"id": "", "title": "连接与模型额度", "keywords": "API key URL 协议 上下文窗口 最大输出 tokens"}], component: p => <ProvidersPane {...p} /> }));
}};
