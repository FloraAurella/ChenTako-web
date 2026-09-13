import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  test(`精简外观设置 ${scheme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline fixture"}' }));
    await page.goto('/#/settings/appearance');
    await expect(page.locator('.appearance-pane')).toBeVisible();
    await expect(page.locator('#themeGrid, .theme-card, #themePackageImportBtn, #themePackageExportBtn, #appearance-themes, #appearance-package')).toHaveCount(0);
    await expect(page.locator('input[name="appearanceMode"]')).toHaveCount(3);
    await page.locator(`.appearance-mode-option:has(input[value="${scheme}"])`).click();
    await page.locator('#appearanceContrastRange').evaluate(element => { element.value = '42'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#appearanceTransparentToggle').click();
    await expect(page.locator('#appearanceContrastValue')).toHaveText('42');
    await expect(page.locator('#appearanceTransparentToggle')).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', scheme);
    await expect(page.locator('#appearanceContrastRange')).toHaveValue('42');
    await expect(page.locator('#appearanceTransparentToggle')).toHaveAttribute('aria-checked', 'true');
    const other = scheme === 'dark' ? 'light' : 'dark';
    await page.locator(`.appearance-mode-option:has(input[value="${other}"])`).click();
    await expect(page.locator('#appearanceContrastRange')).toHaveValue('60');
    await expect(page.locator('#appearanceTransparentToggle')).toHaveAttribute('aria-checked', 'false');
    await page.locator(`.appearance-mode-option:has(input[value="${scheme}"])`).click();
    await expect(page.locator('#appearanceContrastRange')).toHaveValue('42');
    await page.locator('#appearanceTransparentToggle').click();
    await expect(page.locator('#appearanceTransparentToggle')).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    mkdirSync('reports/appearance-controls-2026-09-13', { recursive: true });
    await page.screenshot({ path: `reports/appearance-controls-2026-09-13/${scheme}-${width}.png`, fullPage: true });
    if (width === 1280) {
      await page.getByLabel('搜索设置').fill('主题导入');
      await expect(page.locator('button').filter({ hasText: '主题导入与导出' })).toHaveCount(0);
    }
  });
}
