import type { FrontendModule } from '../../contracts/contributions';
import { createContextSettingsService } from './services/context-service';
import { ContextPane } from './ui/ContextPane';
export const module: FrontendModule = {
 id: 'context', setup({ services, scope }) {
  scope.defer(services.domains.register('context', { id: 'context', create: createContextSettingsService,
hasUnsaved: bridge => Boolean(bridge.get().contextEditing?.dirty || bridge.get().contextEditing?.saving),
canLeave: (service, target) => service.beforeNavigate(target),
reset: (bridge, route) => { if (route?.name !== 'settings' || route.settingsSection !== 'context') { if (bridge.get().contextEditing) bridge.patch({contextEditing:null}); } },
}));
scope.defer(services.settings.register('context', { id:'context', label:"上下文与提示词", icon:'chat', description:"聊天默认与项目覆盖", search:[{"id": "context-prompt", "title": "系统提示词", "keywords": "角色 人格 prompt 项目 继承"}, {"id": "context-budget", "title": "上下文策略", "keywords": "输入预算 自动压缩 阈值 tokens"}, {"id": "context-generation", "title": "生成参数", "keywords": "思考强度 temperature top p 采样"}, {"id": "context-behavior", "title": "输出与会话", "keywords": "流式 streaming 保存对话 user id"}, {"id": "context-compatibility", "title": "模型兼容性", "keywords": "图片输入 图片输出 看图 出图 能力"}], component: p => p.active ? <ContextPane store={p.store} service={p.service} projectId={p.route.settingsProjectId} /> : null }));
}};
