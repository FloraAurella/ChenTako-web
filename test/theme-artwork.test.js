import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { themeArtworkBackground } from '../src/resources/artworks/index.js';
import { createThemeController } from '../src/modules/appearance/controller.js';
import { registerTheme } from '../src/modules/appearance/domain/registry.js';
import definition from '../src/modules/appearance/domain/custom/tako-festival.theme.js';

describe('可信双态背景画作', () => {
  it.each(['tako-daylight.svg', 'tako-nightfall.svg'])('%s 为独立、无可执行内容的 SVG', file => {
    const source = readFileSync(`src/resources/artworks/${file}`, 'utf8');
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.documentElement.getAttribute('viewBox')).toBe('0 0 1600 1000');
    expect(source).not.toMatch(/<(?:script|foreignObject|image|animate|set)\b|\bon\w+=|\b(?:href|src)=/i);
    expect(source.length).toBeLessThan(20000);
  });

  it('两态返回不同源码资源，其他主题不继承章鱼烧画作', () => {
    expect(themeArtworkBackground('tako-festival', 'light')).toContain('tako-daylight.svg');
    expect(themeArtworkBackground('tako-festival', 'dark')).toContain('tako-nightfall.svg');
    expect(themeArtworkBackground('custom', 'light')).toBe('none');
  });

  it('主题应用同步画作，切换无画作主题与重复释放均清除', () => {
    registerTheme(definition, { replace: true });
    registerTheme({ ...definition, id: 'artwork-test-custom' }, { replace: true });
    const controller = createThemeController();
    try {
      controller.applyTheme('tako-festival');
      expect(document.documentElement.style.getPropertyValue('--theme-artwork')).toContain('tako-');
      controller.applyTheme('artwork-test-custom');
      expect(document.documentElement.style.getPropertyValue('--theme-artwork')).toBe('none');
      controller.applyTheme('tako-festival');
    } finally {
      controller.dispose();
      controller.dispose();
    }
    expect(document.documentElement.style.getPropertyValue('--theme-artwork')).toBe('');
  });
});
