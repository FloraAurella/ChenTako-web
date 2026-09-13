import type { FrontendModule } from '../../contracts/contributions';
import { workContext } from './domain/work';
import { createWritingOperation } from './services/operation';
import { writingCommands } from './services/commands';
import { WritingPane, WritingStatus, WritingSidebarButton } from './ui/WritingPane';

export const module: FrontendModule = { id: 'writing', dependsOn: ['commands', 'chat', 'projects', 'context'], setup({ services, scope }) {
  for (const command of writingCommands) scope.defer(services.commands.register('writing', command));
  scope.defer(services.requestContexts.register('writing', { id: 'writing.fulltext', capture: ({ conversation }) => workContext(conversation.writing), createOperation: createWritingOperation }));
  scope.defer(services.slots.register('writing', { id: 'writing.toggle', slot: 'chat.header.actions', component: WritingSidebarButton }));
  scope.defer(services.slots.register('writing', { id: 'writing.status', slot: 'composer.before', component: WritingStatus }));
  scope.defer(services.slots.register('writing', { id: 'writing.panel', slot: 'chat.auxiliary', component: WritingPane }));
} };
