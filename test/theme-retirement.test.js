import { afterEach, beforeEach, expect, it } from 'vitest';
import { createThemeController, migrateLegacyThemePrefs } from '../src/modules/appearance/controller.js';
import { listThemes, unregisterTheme } from '../src/modules/appearance/domain/registry.js';
import { createThemeArchiveStore, THEME_ARCHIVE_KIND, THEME_ARCHIVE_VERSION } from '../src/modules/appearance/domain/archive.js';
import definition from '../src/modules/appearance/domain/custom/tako-festival.theme.js';
let controller;
beforeEach(() => { localStorage.clear(); for (const theme of listThemes()) unregisterTheme(theme.id, { force: true }); });
afterEach(() => controller?.dispose());
it.each(['light', 'dark', 'system'])('old selection migrates while retaining %s preference', appearanceMode => {
  expect(migrateLegacyThemePrefs({themeId:'everforest', appearanceMode})).toEqual({themeId:'tako-festival',appearanceMode});
});
it.each(['user','source'])('retired %s archive cannot replace the new palette; removal persists', async source => {
  const old = {...structuredClone(definition), id:'everforest', label:'Everforest'};
  delete old.baseTheme;
  old.tokens.dark['--canvas-start']='#222a2e';old.tokens.dark['--pear']='#a7c080';
  await createThemeArchiveStore().save({kind:THEME_ARCHIVE_KIND,version:THEME_ARCHIVE_VERSION,removedIds:[],files:[{id:'everforest',path:'themes/everforest.theme.json',source,raw:null,definition:old}]});
  controller=createThemeController();controller.loadCustomThemes();await controller.loadThemeArchive();
  expect(listThemes().map(t=>t.id)).toEqual(['tako-festival']);
  controller.setAppearanceMode('dark');controller.applyTheme('tako-festival');
  expect(document.documentElement.style.getPropertyValue('--pear')).toBe(definition.tokens.dark['--pear']);
  const {payload}=await createThemeArchiveStore().load();
  expect(payload.files.map(f=>f.id)).toEqual(['tako-festival']);
  expect(payload.removedIds).toContain('everforest');
  await controller.loadThemeArchive();
  expect(listThemes().map(t=>t.id)).toEqual(['tako-festival']);
});
