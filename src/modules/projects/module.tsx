import type { FrontendModule } from '../../contracts/contributions';
import { ProjectSelector } from './ui/ProjectSelector';
export const module: FrontendModule = { id:'projects', dependsOn:['context'], setup({ services,scope }) {
 scope.defer(services.slots.register('projects', { id:'projects.selector', slot:'composer.before', component:ProjectSelector }));
}};
