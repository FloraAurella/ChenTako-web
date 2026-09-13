import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// 用户确认的 ChenTako 品牌及单色章鱼烧；截图为本轮证据，不覆盖既有基线。
for (const scheme of ['light', 'dark']) {
  for (const width of [1280, 1024, 390]) {
    test(`ChenTako 品牌 ${scheme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.addInitScript((appearanceMode) => {
        localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'everforest', appearanceMode }));
      }, scheme);
      await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"品牌回归：后端未连接"}' }));
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      mkdirSync('reports/tako-reference-2026-09-13', { recursive: true });
      for (const [name, url] of [['chat', '/'], ['about', '/#/settings/about'], ['data', '/#/settings/data'], ['appearance', '/#/settings/appearance'], ['onboarding', '/onboarding.html']]) {
        await page.goto(url);
        await expect(page).toHaveTitle('ChenTako');
        await expect(page.locator(name === 'onboarding' ? '#onboardingTitle' : '.app-shell')).toBeVisible();
        await expect(page.locator('body')).not.toContainText('ai-chatbox');
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (name === 'onboarding') {
          await expect(page.locator('#onboardingFreshBtn')).toBeDisabled();
          await expect(page.locator('#onboardingTitle')).toHaveText('欢迎使用 ChenTako');
        }
        await page.screenshot({ path: `reports/tako-reference-2026-09-13/${name}-${scheme}-${width}.png`, fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}
