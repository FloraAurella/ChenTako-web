import type { FrontendModule } from '../../contracts/contributions';
import { createDataSettingsService } from './services/data-service';
import { DataPane, AboutPane } from './ui/DataPane';
export const module: FrontendModule = {
 id: 'data', setup({ services, scope }) {
  scope.defer(services.domains.register('data', { id: 'data', create: createDataSettingsService,
}));
scope.defer(services.settings.register('data', { id:'data', label:"数据管理", icon:'database', description:"导入、迁移与备份", search:[{"id": "legacy-settings", "title": "旧配置备份", "keywords": "提示词 迁移"}, {"id": "data-import", "title": "导入对话", "keywords": "json zip"}, {"id": "data-migration", "title": "数据迁移", "keywords": "加密 导出"}], component: p => <DataPane {...p} /> }));
scope.defer(services.settings.register('data', { id:'about', label:"关于与更新", icon:'book', description:"版本与运行环境", search:[{"id": "about-runtime", "title": "版本与运行环境", "keywords": "健康检查 更新日志"}], component: p => <AboutPane store={p.store} service={p.service} /> }));
}};
