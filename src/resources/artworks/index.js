import daylight from './tako-daylight.svg?url&no-inline';
import nightfall from './tako-nightfall.svg?url&no-inline';
import { registerSystem, resources } from '../registry.js';

// 可信源码画作。随新版主题独立 ID 注册；用户主题不能注册 artwork 资源。
registerSystem('artwork', {
  'tako-festival/light': daylight,
  'tako-festival/dark': nightfall
});

export function themeArtworkBackground(themeId, scheme) {
  const url = resources.resolve(`artwork/${themeId}/${scheme}`, null);
  return typeof url === 'string' ? `url(${JSON.stringify(url)})` : 'none';
}
