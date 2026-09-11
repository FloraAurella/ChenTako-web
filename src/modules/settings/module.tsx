import type { FrontendModule } from '../../contracts/contributions';
import { SettingsIndex } from './ui/SettingsIndex';
import { SettingsContent } from './ui/SettingsContent';
function SettingsPage({store,active,settings,route}: {store:any;active:boolean;settings:any;route:any}) {
 return <div className="settings-layout"><SettingsIndex section={route.settingsSection} /><SettingsContent store={store} service={settings} active={active} /></div>;
}
export const module: FrontendModule = {id:'settings',setup({services,scope}) {
 scope.defer(services.pages.register('settings',{id:'settings',label:'设置',icon:'settings',component:SettingsPage}));
}};
