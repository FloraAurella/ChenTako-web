import themePackage from './everforest-ai-chatbox-theme-v1.json' with { type: 'json' };
import { resources } from '../registry.js';
resources.register({id:'theme/default',owner:'system',layer:'system',value:themePackage});
export function defaultThemePackage() {return resources.resolve('theme/default');}
