import type { FrontendModule } from '../../contracts/contributions';
import { captureKnowledge } from './domain/library';
import { KnowledgePane, KnowledgeStatus } from './ui/KnowledgePane';
export const module: FrontendModule = { id: 'knowledge', dependsOn: ['projects', 'context'], setup({ services, scope }) {
  scope.defer(services.requestContexts.register('knowledge', { id: 'knowledge.fulltext', capture(input) {
    const context = captureKnowledge(input);
    return { ...context, groups: context.text ? [{ id: 'knowledge.fulltext', label: '固定项目资料', text: context.text }] : [] };
  } }));
  scope.defer(services.slots.register('knowledge', { id: 'knowledge.status', slot: 'composer.before', component: KnowledgeStatus }));
  scope.defer(services.slots.register('knowledge', { id: 'knowledge.project-settings', slot: 'project.settings', component: ({ store, projectId }) => projectId ? <KnowledgePane store={store} projectId={projectId} /> : null }));
} };
