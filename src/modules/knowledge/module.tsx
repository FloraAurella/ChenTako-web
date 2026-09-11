import type { FrontendModule } from '../../contracts/contributions';
import { captureKnowledge } from './domain/library';
import { KnowledgePane, KnowledgeStatus } from './ui/KnowledgePane';
export const module: FrontendModule = { id: 'knowledge', dependsOn: ['projects', 'context'], setup({ services, scope }) {
  scope.defer(services.requestContexts.register('knowledge', { id: 'knowledge.fulltext', capture: captureKnowledge }));
  scope.defer(services.slots.register('knowledge', { id: 'knowledge.status', slot: 'composer.before', component: KnowledgeStatus }));
  scope.defer(services.settings.register('knowledge', { id: 'knowledge', label: '项目知识库', icon: 'folder', description: '完整资料、项目隔离与本地备份',
    search: [{ id: 'knowledge-project', title: '项目知识库', keywords: '上传 文件 资料 全文 备份' }], component: props => <KnowledgePane store={props.store} active={props.active} /> }));
} };
