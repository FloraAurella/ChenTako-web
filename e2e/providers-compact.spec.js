import { test, expect } from '@playwright/test';
async function load(page, scheme = 'light') {
  await page.addInitScript((scheme) => {
    localStorage.setItem('tribblebook-v6-state', JSON.stringify({ providers: [{ id: 'compact', displayName: '示例供应商', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['model-a', 'model-b'], defaultModel: 'model-a' }] }));
    localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'default', appearanceMode: scheme }));
  }, scheme);
  await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/providers', r => r.fulfill({ json: r.request().method() === 'PUT' ? { provider: r.request().postDataJSON() } : { providers: [] } }));
  await page.goto('/#/settings/providers/compact');
  await expect(page.locator('#pf-enabled')).toBeVisible();
}
for (const width of [1280, 1024, 390]) for (const scheme of ['light', 'dark']) {
  test(`compact provider ${width} ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await load(page, scheme);
    await expect(page.locator('.provider-detail-head #pf-enabled')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.provider-detail-head #pf-delete')).toBeVisible();
    await expect(page.getByText('供应商管理', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '测试模型', exact: true })).toHaveCount(2);
    await page.locator('#pf-enabled').click();
    await expect(page.locator('#pf-enabled')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#pf-save')).toHaveCount(0);
    await expect(page.locator('.provider-auto-state')).toHaveText('已保存');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.provider-model-meta')).toHaveCount(0);
    await page.screenshot({ path: `reports/settings-autosave/${width}-${scheme}.png`, fullPage: true });
  });
}
test('model response, failure, repeat and cancellation stay on their model row', async ({ page }) => {
  await load(page);
  let requests = [];
  await page.route('**/api/providers/test', async r => {
    const body = r.request().postDataJSON(); requests.push(body);
    await r.fulfill(body.model === 'model-a' ? { json: { reply: 'OK', latencyMs: 23 } } : { status: 403, json: { error: '模型无权限' } });
  });
  const a = page.locator('[data-model-row="model-a"]');
  const b = page.locator('[data-model-row="model-b"]');
  await a.getByRole('button', { name: '测试模型' }).click();
  await expect(a).toContainText('响应成功 · 23ms · OK');
  await b.getByRole('button', { name: '测试模型' }).click();
  await expect(b).toContainText('模型无权限');
  expect(requests.map(r => r.model)).toEqual(['model-a', 'model-b']);
  await page.route('**/api/providers/test', async r => { await new Promise(resolve => setTimeout(resolve, 500)); await r.fulfill({ json: { reply: 'late', latencyMs: 500 } }).catch(() => {}); });
  await a.getByRole('button', { name: '测试模型' }).click();
  await a.getByRole('button', { name: '取消测试' }).click();
  await expect(a).toContainText('已取消');
  await expect(a).not.toContainText('late');
});

test('leaving the editor cancels a pending model test and discards its feedback', async ({ page }) => {
  await load(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/providers/test', async r => {
    await pending;
    await r.fulfill({ json: { reply: 'stale-result', latencyMs: 100 } }).catch(() => {});
  });
  await page.locator('[data-model-row="model-a"]').getByRole('button', { name: '测试模型' }).click();
  await expect(page.getByRole('button', { name: '取消测试' })).toBeVisible();
  await page.evaluate(() => { location.hash = '#/settings/context'; });
  await expect(page.locator('[data-model-row]')).toHaveCount(0);
  release();
  await page.evaluate(() => { location.hash = '#/settings/providers/compact'; });
  await expect(page.getByRole('button', { name: '测试模型', exact: true })).toHaveCount(2);
  await expect(page.locator('.provider-model-test-result')).toHaveCount(0);
  await page.locator('#pf-delete').click();
  await expect(page.locator('.dialog-card')).toBeVisible();
  await page.locator('.dialog-card [data-role="cancel"]').click();
  await expect(page.locator('#pf-delete')).toBeVisible();
});
