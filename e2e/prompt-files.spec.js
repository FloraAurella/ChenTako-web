import { test, expect } from '@playwright/test';
for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  test(`文件提示词设置 ${scheme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(scheme => {
      localStorage.setItem('tribblebook-v6-state', JSON.stringify({ settingsSchemaVersion: 2, chatConfig: { systemPrompt: '旧设置不得生效' }, projects: [], conversations: [], providers: [] }));
      localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ appearanceMode: scheme }));
    }, scheme);
    await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
    await page.route('**/api/providers', r => r.fulfill({ json: { providers: [] } }));
    await page.goto('/#/settings/context');
    await expect(page.locator('#context-budget')).toBeVisible();
    await expect(page.locator('#context-prompt')).toHaveCount(0);
    await expect(page.locator('#cc-systemPrompt')).toHaveCount(0);
    await expect(page.locator('#cc-compressionThreshold')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
