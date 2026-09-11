import { chatCommands } from './services/commands';
import type { FrontendModule } from '../../contracts/contributions';
import { ChatSurface } from './ui/ChatSurface';
import { createChatController } from './controller.js';
export const module: FrontendModule = { id:'chat', dependsOn:['commands','connections','context','appearance','projects'], setup({services,scope}) {
 for (const command of chatCommands) scope.defer(services.commands.register('chat',command));
 scope.defer(services.pages.register('chat',{id:'chat',label:'对话',icon:'chat',component:ChatSurface}));
 scope.defer(services.controllers.register('chat',{id:'chat',create:createChatController}));
}};
