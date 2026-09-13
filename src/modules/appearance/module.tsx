import type { FrontendModule } from '../../contracts/contributions';
import { createAppearanceSettingsService } from './services/appearance-service';
import { AppearancePane } from './ui/AppearancePane';
export const module: FrontendModule = {
 id: 'appearance', setup({ services, scope }) {
  scope.defer(services.domains.register('appearance', { id: 'appearance', create: createAppearanceSettingsService,
}));
scope.defer(services.settings.register('appearance', { id:'appearance', label:"外观", icon:'palette', description:"明暗模式、对比度与透景", search:[{"id": "appearance-mode", "title": "明暗模式", "keywords": "浅色 深色 系统"}, {"id": "appearance-background", "title": "界面层次", "keywords": "背景 对比度 透明 透景"}], component: p => <AppearancePane service={p.service} state={p.state} /> }));
}};
