import { test, expect } from '@playwright/test';
const storageKey = 'tribblebook-v6-state';
async function load(page, { count = 1, models = 2, scheme = 'light' } = {}) {
  const providers = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, displayName: `供应商 ${i}`, baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', defaultModel: 'model-0', models: Array.from({ length: models }, (_, n) => `model-${n}`) }));
  await page.addInitScript(({ providers, scheme, storageKey }) => {
    if (!localStorage.getItem('autosave-seeded')) {
      localStorage.setItem('autosave-seeded', '1');
      localStorage.setItem(storageKey, JSON.stringify({ providers, projects: [{ id: 'project', name: '项目', configOverrides: {} }], settingsSchemaVersion: 1 }));
      localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'default', appearanceMode: scheme }));
    }
  }, { providers, scheme, storageKey });
  await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/providers', r => r.fulfill({ json: r.request().method() === 'PUT' ? { provider: r.request().postDataJSON() } : { providers: [] } }));
  await page.goto('/#/settings/providers/p0');
  await expect(page.locator('#pf-name')).toBeVisible();
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
for (const width of [1280, 1024]) for (const scheme of ['light', 'dark']) {
  test(`independent wheel scrolling ${width} ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await load(page, { count: 35, models: 60, scheme });
    const rail = page.locator('.provider-rail-list'); const detail = page.locator('.provider-detail');
    const scroll = locator => locator.evaluate(el => el.scrollTop);
    await rail.hover(); await page.mouse.wheel(0, 500);
    await expect.poll(() => scroll(rail)).toBeGreaterThan(100); expect(await scroll(detail)).toBe(0);
    const left = await scroll(rail);
    await detail.hover(); await page.mouse.wheel(0, 600);
    await expect.poll(() => scroll(detail)).toBeGreaterThan(100); expect(await scroll(rail)).toBe(left);
    expect(await page.locator('#settingsContent').evaluate(el => el.scrollTop)).toBe(0);
    await rail.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const right = await scroll(detail);
    await rail.hover(); await page.mouse.wheel(0, 500);
    expect(await scroll(detail)).toBe(right);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `reports/settings-autosave/scroll-${width}-${scheme}.png` });
  });
}
for (const width of [1600, 1280, 1024, 390]) for (const scheme of ["light", "dark"]) {
  test(`all primary settings cards use the provider width ${width} ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await load(page, { scheme });
    const expected = await page.locator('.provider-registry').boundingBox();
    for (const section of ['appearance', 'context', 'tools', 'skills', 'data', 'about']) {
      await page.evaluate(section => { location.hash = `#/settings/${section}`; }, section);
      const card = page.locator('.settings-content .settings-card').first();
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(Math.abs(box.x - expected.x), section).toBeLessThan(2);
      expect(Math.abs(box.width - expected.width), section).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), section).toBe(true);
      await expect(page.locator('.settings-content').getByRole('button', { name: '保存更改', exact: true })).toHaveCount(0);
    }
  });
}
test('first-level configuration survives refresh; second-level parameters save only from the dialog', async ({ page }) => {
  await load(page);
  await page.locator('#pf-name').fill('即时保存'); await page.locator('#pf-enabled').click();
  await expect(page.locator('.provider-auto-state')).toHaveText('已保存');
  await page.reload();
  await expect(page.locator('#pf-name')).toHaveValue('即时保存');
  await expect(page.locator('#pf-enabled')).toHaveAttribute('aria-checked', 'false');
  await page.locator('[data-model-row="model-0"]').getByRole('button', { name: '编辑模型' }).click();
  await page.locator('#model-id').fill('cancelled'); await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('[data-model-row="model-0"]')).toBeVisible();
  await page.locator('[data-model-row="model-0"]').getByRole('button', { name: '编辑模型' }).click();
  await page.locator('#model-id').fill('saved-model');
  expect((await stored(page)).providers[0].models).toContain('model-0');
  await page.getByRole('dialog').getByRole('button', { name: '保存更改' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await expect(page.locator('[data-model-row="saved-model"]')).toBeVisible();
  await page.evaluate(() => { location.hash = '#/settings/context'; });
  await page.locator('#cc-systemPrompt').fill('自动保存提示词');
  await expect(page.locator('.context-auto-state')).toHaveText('已自动保存');
  await page.reload(); await expect(page.locator('#cc-systemPrompt')).toHaveValue('自动保存提示词');
});
test('first-level errors retain input and offer retry', async ({ page }) => {
  await load(page);
  await page.route('**/api/providers', r => r.fulfill({ status: 503, json: { error: 'offline' } }));
  await page.locator('#pf-name').fill('保留输入');
  await expect(page.locator('.provider-auto-error')).toContainText('offline');
  await expect(page.locator('#pf-name')).toHaveValue('保留输入');
  await page.route('**/api/providers', r => r.fulfill({ json: { provider: r.request().postDataJSON() } }));
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.locator('.provider-auto-state')).toHaveText('已保存');
});

test('new empty provider saves automatically; incomplete creation can be cancelled', async ({ page }) => {
  await load(page);
  await page.locator('#newProviderBtn').click();
  await page.locator('[data-preset="blank-responses"]').click();
  await page.getByRole('button', { name: '取消添加供应商' }).click();
  await page.locator('.dialog-card [data-role="confirm"]').click();
  await expect(page.locator('#pf-name')).toHaveValue('供应商 0');
  await page.locator('#newProviderBtn').click();
  await page.locator('[data-preset="blank-responses"]').click();
  await page.locator('#pf-name').fill('新供应商'); await page.locator('#pf-url').fill('https://new.example.com/v1');
  await expect(page.locator('.provider-auto-state')).toHaveText('已保存');
  await expect(page.locator('.provider-model-empty')).toContainText('暂无模型');
  await page.reload(); await expect(page.locator('#pf-name')).toHaveValue('新供应商');
});
test('phone returns to independently scrolling provider list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 }); await load(page, { count: 30, models: 30 });
  const detail = page.locator('.provider-detail'); await detail.hover(); await page.mouse.wheel(0, 700);
  await expect.poll(() => detail.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await detail.evaluate(el => { el.scrollTop = 0; });
  await page.getByRole('button', { name: '返回供应商列表' }).click();
  const rail = page.locator('.provider-rail-list'); await expect(rail).toBeVisible();
  await rail.hover(); await page.mouse.wheel(0, 500);
  await expect.poll(() => rail.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await page.locator('[data-edit-provider="p10"]').click();
  await expect(page.locator('#pf-name')).toHaveValue('供应商 10');
});
