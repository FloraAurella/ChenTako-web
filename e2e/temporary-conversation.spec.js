import { test, expect } from '@playwright/test';
const provider = { id: 'a', displayName: '测试供应商', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['model-a'], defaultModel: 'model-a', contextWindow: 131072, maxTokens: 8192, hasKeyConfigured: true };
async function load(page, { providers = [provider], projects = [] } = {}) {
  await page.addInitScript(({ providers, projects }) => {
    if (localStorage.getItem('temporary-test-seeded')) return;
    localStorage.setItem('temporary-test-seeded', 'true');
    localStorage.setItem('tribblebook-v6-state', JSON.stringify({ settingsSchemaVersion: 1, providers, projects, activeProviderId: 'a', activeConversationId: 'old', conversations: [{ id: 'old', title: '已有对话', providerId: 'a', model: 'model-a', messages: [{ id: 'u', role: 'user', content: '历史' }] }], chatConfig: { streaming: false, systemPrompt: '', autoCompress: false } }));
  }, { providers, projects });
  await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/providers', r => r.fulfill({ json: { providers: [] } }));
  await page.route('**/api/providers/key*', r => r.fulfill({ json: { apiKey: 'fixture' } }));
  await page.goto('/#/chat'); await expect(page.locator('#composerInput')).toBeVisible();
}
const rows = page => page.locator('.conversation-item');
const input = page => page.locator('#composerInput');
test('新建不入历史，反复新建、指令和切换保留临时草稿附件，首次发送才加入', async ({ page }) => {
  await load(page);
  await page.route('**/api/chat', r => r.fulfill({ json: { choices: [{ message: { content: '收到' } }] } }));
  await page.locator('#newConversationBtn').click();
  await expect(rows(page)).toHaveCount(1);
  await input(page).fill('/effort high'); await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await input(page).fill('这才是首次发言');
  await page.locator('#attachmentInput').setInputFiles({ name: 'draft.txt', mimeType: 'text/plain', buffer: Buffer.from('附件内容') });
  await page.locator('#newConversationBtn').click(); await expect(input(page)).toHaveValue('这才是首次发言');
  await page.locator('[data-conversation-id="old"]').click();
  await page.locator('#newConversationBtn').click();
  await expect(input(page)).toHaveValue('这才是首次发言');
  await expect(page.locator('#composerChips')).toContainText('draft.txt');
  await expect(rows(page)).toHaveCount(1);
  await page.locator('#sendBtn').click();
  await expect(rows(page)).toHaveCount(2); await expect(rows(page)).toContainText(['这才是首次发言', '已有对话']);
  await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  await page.locator('#newConversationBtn').click(); await expect(rows(page)).toHaveCount(2);
});
test('刷新恢复待发送草稿且不加入历史', async ({ page }) => {
  await load(page); await page.locator('#newConversationBtn').click(); await input(page).fill('刷新恢复草稿');
  await expect.poll(() => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('tribblebook-drafts-v1') || '{}')).includes('刷新恢复草稿'))).toBe(true);
  await page.reload(); await expect(input(page)).toHaveValue('刷新恢复草稿'); await expect(rows(page)).toHaveCount(1);
});
test('前置校验失败不加入且保留输入', async ({ page }) => {
  await load(page, { providers: [] }); await page.locator('#newConversationBtn').click();
  await input(page).fill('没有模型先不发送'); await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(1); await expect(input(page)).toHaveValue('没有模型先不发送');
});
test('项目内待发送会话首次发言后进入该项目，HTTP 错误不撤回历史', async ({ page }) => {
  await load(page, { projects: [{ id: 'p', name: '项目 P' }] });
  await page.route('**/api/chat', r => r.fulfill({ status: 500, json: { error: '模拟失败' } }));
  await page.locator('[data-project-id="p"] .project-row').hover();
  await page.locator('[data-project-id="p"] [data-project-action="new-chat"]').click();
  await expect(page.locator('[data-project-id="p"] .conversation-item')).toHaveCount(0);
  await input(page).fill('项目第一条'); await page.locator('#sendBtn').click();
  await expect(page.locator('[data-project-id="p"] .conversation-item')).toHaveCount(1);
  await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  await expect(rows(page)).toHaveCount(2);
});

for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  test(`待发送界面 ${scheme} ${width} 不增加历史且无横向溢出`, async ({ page }, testInfo) => {
    await page.addInitScript(scheme => localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'everforest', appearanceMode: scheme })), scheme);
    await load(page); await page.locator('#newConversationBtn').click();
    await page.setViewportSize({ width, height: 840 });
    await expect(input(page)).toBeVisible(); await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.conversation-item.is-selected')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`temporary-${scheme}-${width}.png`) });
  });
}
