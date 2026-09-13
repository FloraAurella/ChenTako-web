import { test, expect } from '@playwright/test';

test('画作跟随明暗切换，透景模式不改变画作且刷新恢复', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline fixture"}' }));
  await page.goto('/#/settings/appearance');
  const artwork = () => page.locator('.app-canvas').evaluate(el => getComputedStyle(el, '::before').backgroundImage);
  await page.locator('.appearance-mode-option').filter({ hasText: '浅色' }).click();
  await expect.poll(artwork).toContain('tako-daylight');
  await page.locator('.appearance-mode-option').filter({ hasText: '深色' }).click();
  await expect.poll(artwork).toContain('tako-nightfall');
  await page.locator('#appearanceTransparentToggle').click();
  await expect(page.locator('html')).toHaveClass(/transparency-mode/);
  await expect.poll(artwork).toContain('tako-nightfall');
  await page.reload();
  await expect.poll(artwork).toContain('tako-nightfall');
  await expect(page.locator('html')).toHaveClass(/transparency-mode/);
  await page.locator('#appearanceTransparentToggle').click();
  await expect(page.locator('html')).not.toHaveClass(/transparency-mode/);
  await expect(page.locator('#themeGrid, #themePackageImportBtn')).toHaveCount(0);
});
