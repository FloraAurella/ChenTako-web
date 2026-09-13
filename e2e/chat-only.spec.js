import { test, expect } from '@playwright/test';
const provider = { id: 'a', displayName: '模拟供应商', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['m'], defaultModel: 'm', contextWindow: 131072, maxTokens: 8192, hasKeyConfigured: true };
const writing = { version: 1, workspaceVersion: 2, revision: 1, mode: 'write', selectedId: 'ch', chapters: [{ id: 'ch', name: '旧章节', revision: 1, body: '不应自动携带的作品正文', candidate: null, versions: [], drafts: [] }] };
async function load(page, scheme) {
  await page.addInitScript(({ provider, writing, scheme }) => {
    if (sessionStorage.getItem('chat-only-seed')) return;
    sessionStorage.setItem('chat-only-seed', '1');
    localStorage.setItem('tribblebook-v6-state', JSON.stringify({ settingsSchemaVersion: 2, chatConfig: { streaming: false }, providers: [provider], projects: [], activeProviderId: 'a', activeConversationId: 'c', conversations: [{ id: 'c', providerId: 'a', model: 'm', messages: [], saveChats: true, writing }] }));
    localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'tako-festival', appearanceMode: scheme }));
  }, { provider, writing, scheme });
  await page.route('**/src/resources/public/prompts.js*', r => r.fulfill({ contentType: 'application/javascript', body: 'export function promptText(name){if(name!=="system")throw Error("Inactive prompt");return "SYSTEM_ONLY_FIXTURE";}' }));
  await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/providers', r => r.fulfill({ json: { providers: [] } }));
  await page.route('**/api/providers/key*', r => r.fulfill({ json: { apiKey: 'mock-only' } }));
  await page.route('**/api/chat/title', r => r.fulfill({ json: { title: '普通聊天' } }));
  await page.goto('/#/chat');
  await expect(page.locator('#composerInput')).toBeEnabled();
}
for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  test(`chat only ${scheme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = [];
    await page.route('**/api/chat', r => { requests.push(r.request().postDataJSON()); return r.fulfill({ json: { content: '普通聊天回复', reasoning: '', images: [], finishReason: 'stop' } }); });
    await load(page, scheme);
    await expect(page.locator('.writing-pane, .writing-status, #writingSidebarToggle')).toHaveCount(0);
    await page.locator('#composerInput').fill('/');
    await expect(page.locator('.command-option-title')).toHaveText(['模型', '思考强度', '压缩历史', '帮助']);
    for (const input of ['/create 新章', '/name 旧章节 新章', '/write', '/edit', '/chat', '@旧章节']) {
      await page.locator('#composerInput').fill(input);
      await page.locator('#sendBtn').click();
      await expect(page.locator('#composerInput')).toHaveValue(input);
      expect(requests).toHaveLength(0);
    }
    await page.locator('#composerInput').fill('你好');
    await page.locator('#sendBtn').click();
    await expect(page.locator('#messageList')).toContainText('普通聊天回复');
    expect(requests).toHaveLength(1);
    expect(requests[0].chatConfig.systemPrompt).toBe('SYSTEM_ONLY_FIXTURE');
    expect(JSON.stringify(requests[0])).not.toContain('不应自动携带的作品正文');
    await page.reload();
    await expect(page.locator('#messageList')).toContainText('普通聊天回复');
    await expect(page.locator('.writing-pane, .writing-status, #writingSidebarToggle')).toHaveCount(0);
    const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('tribblebook-v6-state')).conversations.find(c => c.id === 'c').writing);
    expect(retained.mode).toBe('write');
    expect(retained.chapters[0].body).toBe(writing.chapters[0].body);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
