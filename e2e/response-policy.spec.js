import { test, expect } from '@playwright/test';
const provider = { id: 'p', displayName: '对话供应商', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['chat', 'helper'], defaultModel: 'chat', contextWindow: 10000, maxTokens: 1000, hasKeyConfigured: true };
async function load(page, { streaming = false, messages = [], config = {}, width = 1280, scheme = 'light', hash = '#/chat' } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ provider, streaming, messages, config, scheme }) => {
    if (localStorage.getItem('response-policy-seeded')) return;
    localStorage.setItem('response-policy-seeded', '1');
    localStorage.setItem('tribblebook-v6-state', JSON.stringify({ settingsSchemaVersion: 2, providers: [provider], projects: [{ id: 'project', name: '项目' }], activeProviderId: 'p', activeConversationId: 'c',
      chatConfig: { streaming, systemPrompt: '', compressionThreshold: 10, compressionModel: { providerId: 'p', model: 'helper' }, titleModel: { providerId: 'p', model: 'helper' }, ...config },
      conversations: [{ id: 'c', title: '', providerId: 'p', model: 'chat', projectId: 'project', messages }, { id: 'other', title: '其他对话', providerId: 'p', model: 'chat', messages: [{ id: 'old', role: 'user', content: '旧消息' }] }] }));
    localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'default', appearanceMode: scheme }));
  }, { provider, streaming, messages, config, scheme });
  await page.route('**/api/health', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/providers', r => r.fulfill({ json: { providers: [] } }));
  await page.route('**/api/chat/title', r => r.fulfill({ json: { ok: true, title: '首次要求标题' } }));
  await page.goto(`/${hash}`);
  await expect(page.locator('#appShell')).toBeVisible();
}
const send = async (page, text = '第一次要求') => { await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click(); };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('tribblebook-v6-state')));
const reply = content => ({ choices: [{ message: { role: 'assistant', content } }] });

for (const streaming of [false, true]) test(`响应结束自动压缩，首次标题并行且模型独立 ${streaming ? '流式' : '非流式'}`, async ({ page }) => {
  await load(page, { streaming });
  let release; const gate = new Promise(r => { release = r; }); let chat; let compact; let title; let compactCalls = 0;
  await page.route('**/api/chat/title', r => { title = r.request().postDataJSON(); return r.fulfill({ json: { ok: true, title: '首次要求标题' } }); });
  await page.route('**/api/chat', async r => { chat = r.request().postDataJSON(); await gate;
    if (streaming) await r.fulfill({ contentType: 'text/event-stream', body: [
      ['chat.stream.started', { version: 1, providerId: 'p', reasoningKind: 'thinking' }],
      ['chat.content.delta', { delta: '完整回答'.repeat(600) }],
      ['chat.stream.completed', { finishReason: 'stop' }]
    ].map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('') });
    else await r.fulfill({ json: reply('完整回答'.repeat(600)) });
  });
  await page.route('**/api/chat/compress', r => { compactCalls++; compact = r.request().postDataJSON(); return r.fulfill({ json: { summary: '压缩后的摘要' } }); });
  await send(page);
  await expect.poll(() => !!chat && !!title).toBe(true);
  expect(compactCalls).toBe(0);
  expect(title).toMatchObject({ model: 'helper', input: '第一次要求' });
  expect(title).not.toHaveProperty('messages');
  expect(chat.model).toBe('chat');
  await expect(page.locator('#runtimeBtn')).toBeDisabled();
  await page.locator('#composerInput').fill('下一条草稿');
  release();
  await expect.poll(() => compactCalls).toBe(1);
  expect(compact.model).toBe('helper'); expect(compact.messages).toHaveLength(2);
  expect(compact.messages[1].content).toBe('完整回答'.repeat(600));
  expect(JSON.stringify(compact)).not.toContain('下一条草稿');
  await expect(page.locator('#composerInput')).toHaveValue('下一条草稿');
  await expect(page.locator('#runtimeBtn')).toBeEnabled();
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('压缩后的摘要');
});

test('首次锁定菜单和模型指令，停止后解锁且不自动压缩', async ({ page }) => {
  await load(page); let calls = 0; let requested = false;
  await page.route('**/api/chat', async r => { requested = true; await new Promise(resolve => page.once('close', resolve)); await r.abort().catch(() => {}); });
  await page.route('**/api/chat/compress', r => { calls++; return r.fulfill({ json: { summary: '不应触发' } }); });
  await send(page); await expect.poll(() => requested).toBe(true);
  await page.locator('.conversation-item[data-conversation-id="c"]').hover();
  await page.locator('[data-conversation-id="c"] [data-conv-action="menu"]').click();
  for (const action of ['rename', 'delete', 'pin', 'move']) await expect(page.locator(`[data-menu-action="${action}"]`)).toBeDisabled();
  await expect(page.locator('[data-menu-action="export"]')).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.locator('#composerInput').fill('/model helper'); await page.locator('#composerInput').press('Enter');
  await expect(page.locator('.command-feedback')).toContainText('首次响应');
  await page.locator('#sendBtn').click();
  await expect(page.locator('#runtimeBtn')).toBeEnabled(); expect(calls).toBe(0);
  await page.locator('.conversation-item[data-conversation-id="c"]').hover();
  await page.locator('[data-conversation-id="c"] [data-conv-action="menu"]').click();
  await expect(page.locator('[data-menu-action="rename"]')).toBeEnabled();
});

test('首次报错解锁，低于阈值不压缩，重试/刷新/副本不再生成标题', async ({ page }) => {
  await load(page); let titles = 0; let chats = 0; let compacts = 0;
  await page.route('**/api/chat/title', r => { titles++; return r.fulfill({ status: 500, json: { error: '标题失败' } }); });
  await page.route('**/api/chat', r => { chats++; return chats === 1 ? r.fulfill({ status: 500, json: { error: '回答失败' } }) : r.fulfill({ json: reply('短回答') }); });
  await page.route('**/api/chat/compress', r => { compacts++; return r.fulfill({ json: { summary: '摘要' } }); });
  await send(page); await expect(page.locator('#messageList')).toContainText('回答失败');
  await expect(page.locator('#runtimeBtn')).toBeEnabled();
  await send(page, '第二次输入'); await expect(page.locator('#messageList')).toContainText('短回答');
  expect(titles).toBe(1); expect(compacts).toBe(0);
  await page.reload(); await expect(page.locator('#composerInput')).toBeEnabled();
  await send(page, '刷新后'); await expect.poll(() => chats).toBe(3); expect(titles).toBe(1);
  await expect(page.locator('[data-message-action="branch"]').last()).toBeEnabled();
  await page.locator('[data-message-action="branch"]').last().click();
  await send(page, '副本消息'); await expect.poll(() => chats).toBe(4); expect(titles).toBe(1);
});

test('自动压缩失败保留回答和下一条草稿，不循环重试', async ({ page }) => {
  await load(page); let release; const gate = new Promise(r => { release = r; }); let attempts = 0;
  await page.route('**/api/chat', r => r.fulfill({ json: reply('回答'.repeat(1000)) }));
  await page.route('**/api/chat/compress', async r => { attempts++; await gate; await r.fulfill({ status: 500, json: { error: '压缩模型失败' } }); });
  await send(page); await expect.poll(() => attempts).toBe(1);
  await page.locator('#composerInput').fill('继续编辑的草稿');
  await expect(page.locator('#sendBtn')).toBeDisabled(); release();
  await expect(page.locator('#page-chat')).toContainText('压缩模型失败');
  await expect(page.locator('#composerInput')).toHaveValue('继续编辑的草稿');
  await expect(page.locator('#messageList')).toContainText('回答'.repeat(20));
  expect(attempts).toBe(1);
});

for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) test(`上下文策略三个控件与模型继承 ${width} ${scheme}`, async ({ page }, testInfo) => {
  await load(page, { scheme, width, hash: '#/settings/context' });
  await expect(page.locator('#cc-inputBudget')).toHaveCount(0); await expect(page.locator('#cc-autoCompress')).toHaveCount(0);
  await expect(page.locator('#cc-compressionThreshold')).toHaveValue('10');
  await page.locator('#cc-titleModel').selectOption(''); await page.locator('#cc-compressionModel').selectOption(JSON.stringify(['p', 'chat']));
  await expect(page.locator('.context-auto-state')).toContainText('已自动保存');
  await expect.poll(async () => (await saved(page)).chatConfig.titleModel).toBe(null);
  await page.locator('#context-scope').selectOption('project');
  await expect(page.locator('#cc-titleModel')).toBeDisabled();
  await page.locator('#cc-titleModel').locator('..').getByRole('button').click();
  await page.locator('#cc-titleModel').selectOption(JSON.stringify(['p', 'helper']));
  await page.locator('#cc-titleModel').blur();
  await expect.poll(async () => (await saved(page)).projects[0].configOverrides.titleModel).toEqual({ providerId: 'p', model: 'helper' });
  await page.locator('#context-budget').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#context-budget').screenshot({ path: testInfo.outputPath(`policy-${width}-${scheme}.png`) });
});

test('持续滚动不延迟结束压缩，切换会话后摘要写回原对话', async ({ page }) => {
  await load(page, { streaming: true });
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (url, options) => {
      if (String(url) !== '/api/chat') return original(url, options);
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({ start(controller) {
        const frame = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        frame('chat.stream.started', { version: 1, providerId: 'p', reasoningKind: 'thinking' });
        frame('chat.content.delta', { delta: '回答内容'.repeat(600) });
        window.finishPolicyStream = () => { frame('chat.stream.completed', { finishReason: 'stop' }); controller.close(); };
      } }), { headers: { 'Content-Type': 'text/event-stream' } });
    };
  });
  let compact; let release; const gate = new Promise(r => { release = r; });
  await page.route('**/api/chat/compress', async r => { compact = r.request().postDataJSON(); await gate; await r.fulfill({ json: { summary: '原对话摘要' } }); });
  await send(page); await expect(page.locator('#messageList')).toContainText('回答内容');
  await page.evaluate(() => {
    window.policyScrollTimer = setInterval(() => document.getElementById('messageScroll').dispatchEvent(new WheelEvent('wheel', { deltaY: -10 })), 30);
    document.getElementById('messageScroll').dispatchEvent(new WheelEvent('wheel', { deltaY: -10 }));
    window.finishPolicyStream();
  });
  try { await expect.poll(() => !!compact).toBe(true); }
  finally { await page.evaluate(() => clearInterval(window.policyScrollTimer)); }
  await page.locator('.conversation-item[data-conversation-id="other"]').click();
  await page.locator('#composerInput').fill('其他对话草稿'); release();
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('原对话摘要');
  await expect(page.locator('#composerInput')).toHaveValue('其他对话草稿');
  expect((await saved(page)).conversations.find(c => c.id === 'other').contextCompression).toBeFalsy();
});

test('标题晚于首次回答，手动改名优先且不阻塞下一次发送', async ({ page }) => {
  await load(page); let release; const gate = new Promise(r => { release = r; }); let titles = 0; let chats = 0;
  await page.route('**/api/chat/title', async r => { titles++; await gate; await r.fulfill({ json: { title: '晚到的自动标题' } }); });
  await page.route('**/api/chat', r => { chats++; return r.fulfill({ json: reply('完成') }); });
  await send(page); await expect(page.locator('#runtimeBtn')).toBeEnabled();
  await expect.poll(() => titles).toBe(1);
  await page.locator('.conversation-item[data-conversation-id="c"]').hover();
  await page.locator('[data-conversation-id="c"] [data-conv-action="menu"]').click();
  await page.locator('[data-menu-action="rename"]').click();
  await page.getByRole('dialog').getByRole('textbox').fill('我的手动标题');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await send(page, '第二次要求'); await expect.poll(() => chats).toBe(2);
  release();
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').title).toBe('我的手动标题');
  expect(titles).toBe(1);
});

test('专用压缩模型失效不回退，不阻止原模型正常回答', async ({ page }) => {
  await load(page, { config: { compressionModel: { providerId: 'deleted', model: 'gone' } } });
  let attempts = 0;
  await page.route('**/api/chat', r => r.fulfill({ json: reply('回答'.repeat(1000)) }));
  await page.route('**/api/chat/compress', r => { attempts++; return r.fulfill({ json: { summary: '不应回退' } }); });
  await send(page);
  await expect(page.locator('#page-chat')).toContainText('专用模型已不可用');
  await expect(page.locator('#messageList')).toContainText('回答'.repeat(20));
  expect(attempts).toBe(0);
});
