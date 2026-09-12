import { test, expect } from '@playwright/test';

const provider = { id: 'a', displayName: '供应商 A', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['model-a', 'model-b', 'same'], defaultModel: 'model-a', contextWindow: 131072, maxTokens: 8192, hasKeyConfigured: true };
const second = { ...provider, id: 'b', displayName: '供应商 B', models: ['same'] };
const disabled = { ...provider, id: 'disabled', displayName: '禁用供应商', enabled: false, models: ['hidden-model'] };
const history = [
  { id: 'u1', role: 'user', content: '历史问题', createdAt: 1 },
  { id: 'a1', role: 'assistant', content: '历史回答', createdAt: 2 },
  { id: 'u2', role: 'user', content: '最近问题', createdAt: 3 },
  { id: 'a2', role: 'assistant', content: '最近回答', createdAt: 4 }
];
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('tribblebook-v6-state')));
async function load(page, { providers = [provider, second, disabled], messages = [], config = {}, offline = false, scheme = 'light' } = {}) {
  const seed = { settingsSchemaVersion: 1, chatConfig: { systemPrompt: '', streaming: false, inputBudget: null, autoCompress: false, compressionThreshold: 80, defaultReasoningEffort: 'medium', temperature: 0.7, topP: 1, saveChats: true, ...config },
    providers, projects: [], activeProviderId: 'a', activeConversationId: 'c', conversations: [
      { id: 'c', providerId: 'a', model: 'model-a', messages, saveChats: true },
      { id: 'other', providerId: 'a', model: 'model-a', messages: [], saveChats: true, title: '另一个会话', draft: '另一份草稿' }
    ] };
  await page.addInitScript(({ seed, scheme }) => {
    localStorage.setItem('tribblebook-v6-state', JSON.stringify(seed));
    localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'everforest', appearanceMode: scheme }));
  }, { seed, scheme });
  await page.route('**/api/health', route => route.fulfill({ status: offline ? 503 : 200, json: offline ? { error: 'offline' } : { ok: true } }));
  await page.route('**/api/providers', route => route.fulfill({ json: { providers: [] } }));
  await page.route('**/api/providers/key*', route => route.fulfill({ json: { apiKey: 'fixture' } }));
  await page.goto('/#/chat'); await expect(page.locator('#composerInput')).toBeEnabled();
}
async function command(page, text) {
  await page.locator('#composerInput').fill(text);
  // The existing send button submits a complete command when not generating.
  await page.locator('#sendBtn').click();
}

test('无模型也能使用帮助，未知指令不会发送，附件保留', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/chat', r => { requests++; return r.fulfill({ json: {} }); });
  await load(page, { providers: [] });
  await page.locator('#attachmentInput').setInputFiles({ name: '资料.txt', mimeType: 'text/plain', buffer: Buffer.from('资料正文') });
  await command(page, '/help');
  await expect(page.locator('.command-help')).toContainText('//model');
  await expect(page.locator('#composerInput')).toHaveValue('');
  await expect(page.locator('#composerChips')).toContainText('资料.txt');
  await page.locator('#composerInput').press('Escape');
  await command(page, '/unknown');
  await expect(page.locator('.command-feedback')).toContainText('未知指令');
  await expect(page.locator('#composerInput')).toHaveValue('/unknown');
  expect(requests).toBe(0);
});

test('补全、中文搜索、参数选择、恢复跟随配置', async ({ page }) => {
  await load(page);
  const input = page.locator('#composerInput');
  await input.fill('/思考'); await expect(page.getByRole('option')).toHaveCount(1);
  await input.press('Tab'); await expect(input).toHaveValue('/effort ');
  await page.getByRole('option', { name: /高 high/ }).click();
  await expect(page.locator('#effortValue')).toHaveText('高');
  await expect(input).toBeFocused();
  await command(page, '/effort 跟随配置');
  await expect(page.locator('#effortValue')).toHaveText('中等');
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').reasoningEffortOverride).toBeNull();
});

test('模型重名要求选择供应商，禁用模型隐藏，快捷参数与按钮一致', async ({ page }) => {
  await load(page);
  await command(page, '/model same');
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('option', { name: /供应商 B/ }).click();
  await expect(page.locator('#modelValue')).toHaveText('same');
  await expect.poll(async () => (await saved(page)).activeProviderId).toBe('b');
  await command(page, '/model');
  await expect(page.locator('.command-panel')).not.toContainText('hidden-model');
  await page.locator('#composerInput').press('Escape');
  await command(page, '/model model-b');
  await expect(page.locator('#modelValue')).toHaveText('model-b');
  await page.locator('#runtimeBtn').click();
  await page.locator('[data-runtime-open="model"]').click();
  await page.locator('[data-provider-id="a"][data-model="model-a"]').click();
  await expect(page.locator('#modelValue')).toHaveText('model-a');
});

test('部分模型名不会自动执行，无效参数保持输入', async ({ page }) => {
  await load(page); await command(page, '/model model-');
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('#modelValue')).toHaveText('model-a');
  await page.locator('#composerInput').press('Escape');
  await command(page, '/effort wrong');
  await expect(page.locator('.command-feedback')).toContainText('无效强度');
  await expect(page.locator('#composerInput')).toHaveValue('/effort wrong');
  await command(page, '/help extra'); await expect(page.locator('.command-feedback')).toContainText('不接受参数');
});

test('压缩首次补全不执行，重复请求受阻，新草稿不会被清除', async ({ page }) => {
  let calls = 0; let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/chat/compress', async route => { calls++; await gate; await route.fulfill({ json: { summary: '压缩摘要' } }); });
  await load(page, { messages: history });
  const input = page.locator('#composerInput');
  await input.fill('/comp'); await input.press('Enter');
  await expect(input).toHaveValue('/compact'); expect(calls).toBe(0);
  await input.press('Enter'); await expect.poll(() => calls).toBe(1);
  await input.fill('/compact'); await page.locator('#sendBtn').click();
  await expect(page.locator('.command-feedback')).toContainText('等待完成');
  await input.fill('稍后发送的新草稿'); release();
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('压缩摘要');
  await expect(input).toHaveValue('稍后发送的新草稿'); expect(calls).toBe(1);
});

test('空历史保留指令', async ({ page }) => {
  await load(page);
  await command(page, '/compact'); await expect(page.locator('.command-feedback')).toContainText('没有可压缩');
  await expect(page.locator('#composerInput')).toHaveValue('/compact');
});

test('字面量、多行和正文斜杠进入普通消息，指令不进入 Prompt 或标题', async ({ page }) => {
  const bodies = [];
  await page.route('**/api/chat', async r => { bodies.push(r.request().postDataJSON()); await r.fulfill({ json: { choices: [{ message: { content: '回答' } }] } }); });
  await load(page);
  await command(page, '/effort high');
  for (const [text, sent] of [['//model', '/model'], ['正文 /effort', '正文 /effort'], ['/model\n这是一段文本', '/model\n这是一段文本']]) {
    await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click();
    await expect.poll(() => bodies.length).toBe([ '//model', '正文 /effort', '/model\n这是一段文本' ].indexOf(text) + 1);
    await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
    expect(bodies.at(-1).messages.filter(m => m.role === 'user').at(-1).content).toBe(sent);
  }
  expect(bodies[0].reasoningEffort).toBe('high');
  expect(bodies.flatMap(b => b.messages).some(m => m.content === '/effort high')).toBe(false);
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').title).toBe('/model');
});

test('生成期间配置修改只影响下一次请求，停止按钮保持原行为', async ({ page }) => {
  const bodies = []; let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/chat', async r => { bodies.push(r.request().postDataJSON()); if (bodies.length === 1) await gate; await r.fulfill({ json: { choices: [{ message: { content: '完成' } }] } }); });
  await load(page);
  const input = page.locator('#composerInput');
  await input.fill('第一轮'); await page.locator('#sendBtn').click(); await expect.poll(() => bodies.length).toBe(1);
  await input.fill('/model model-b'); await input.press('Enter');
  await expect(page.locator('#modelValue')).toHaveText('model-b');
  await input.fill('/effort high'); await input.press('Enter');
  await expect(page.locator('#effortValue')).toHaveText('高');
  await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '停止生成');
  expect(bodies[0].model).toBe('model-a'); expect(bodies[0].reasoningEffort).toBe('medium');
  release(); await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  await input.fill('第二轮'); await page.locator('#sendBtn').click(); await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].model).toBe('model-b'); expect(bodies[1].reasoningEffort).toBe('high');
});

test('输入法确认不会执行指令，关闭和会话切换保留草稿', async ({ page }) => {
  await load(page);
  const input = page.locator('#composerInput');
  await input.fill('/effort high');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(page.locator('#effortValue')).toHaveText('中等');
  await input.press('Escape'); await expect(input).toHaveValue('/effort high');
  await input.fill('/model '); await expect(page.locator('.command-panel')).toBeVisible();
  await page.locator('[data-conversation-id="other"]').click();
  await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(input).toHaveValue('另一份草稿');
  await page.locator('[data-conversation-id="c"]').click(); await expect(input).toHaveValue('/model ');
});

for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  test(`指令面板 ${scheme} ${width} 无溢出且 panel 悬停稳定`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 840 }); await load(page, { scheme });
    await page.locator('#composerInput').fill('/');
    const panel = page.locator('.command-panel'); await expect(panel).toBeVisible();
    const paint = el => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderColor]; };
    const before = await panel.evaluate(paint); await panel.hover(); expect(await panel.evaluate(paint)).toEqual(before);
    const rect = await panel.boundingBox(); const input = await page.locator('#composerInput').boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(input.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`commands-${scheme}-${width}.png`) });
  });
}

test('发送准备时切换按钮模型，自动压缩和随后发送仍使用原请求快照', async ({ page }) => {
  const messages = Array.from({ length: 4 }, (_, i) => [
    { id: `u${i}`, role: 'user', content: '历史内容'.repeat(100) },
    { id: `a${i}`, role: 'assistant', content: '历史回复'.repeat(100) }
  ]).flat();
  let compressed; let sent; let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/chat/compress', async r => { compressed = r.request().postDataJSON(); await gate; await r.fulfill({ json: { summary: '简短历史摘要' } }); });
  await page.route('**/api/chat', async r => { sent = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { content: '继续' } }] } }); });
  await load(page, { messages, config: { inputBudget: 1500, autoCompress: true } });
  await page.locator('#composerInput').fill('接着讲'); await page.locator('#sendBtn').click();
  await expect.poll(() => Boolean(compressed)).toBe(true);
  await page.locator('#runtimeBtn').click(); await page.locator('[data-runtime-open="model"]').click();
  await page.locator('[data-provider-id="a"][data-model="model-b"]').click();
  await expect(page.locator('#modelValue')).toHaveText('model-b'); release();
  await expect.poll(() => Boolean(sent)).toBe(true);
  expect(compressed.model).toBe('model-a'); expect(sent.model).toBe('model-a');
  expect(sent.reasoningEffort).toBe('medium');
  await expect(page.locator('#modelValue')).toHaveText('model-b');
});

test('压缩失败保留指令和附件且不创建普通指令消息', async ({ page }) => {
  await page.route('**/api/chat/compress', r => r.fulfill({ status: 500, json: { error: '模拟服务失败' } }));
  await load(page, { messages: history });
  await page.locator('#attachmentInput').setInputFiles({ name: '保留.txt', mimeType: 'text/plain', buffer: Buffer.from('本地资料') });
  await command(page, '/compact');
  await expect(page.locator('.command-feedback')).toContainText('未完成');
  await expect(page.locator('#composerInput')).toHaveValue('/compact');
  await expect(page.locator('#composerChips')).toContainText('保留.txt');
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').messages.filter(m => m.role === 'user').length).toBe(2);
});

test('异步压缩完成后不修改其他会话草稿', async ({ page }) => {
  let release; let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/chat/compress', async r => { calls++; await gate; await r.fulfill({ json: { summary: '摘要' } }); });
  await load(page, { messages: history }); await command(page, '/compact');
  await expect.poll(() => calls).toBe(1);
  await page.locator('[data-conversation-id="other"]').click(); release();
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('摘要');
  await expect(page.locator('#composerInput')).toHaveValue('另一份草稿');
  await expect(page.locator('.command-feedback')).toBeHidden();
});

test('参数 Tab 只补全，方向键 Enter 选择，点击外部保留输入', async ({ page }) => {
  await load(page); const input = page.locator('#composerInput');
  await input.fill('/effort hi'); await input.press('Tab');
  await expect(input).toHaveValue('/effort high'); await expect(page.locator('#effortValue')).toHaveText('中等');
  await input.press('Enter'); await expect(page.locator('#effortValue')).toHaveText('高');
  await input.fill('/effort '); await input.press('ArrowDown'); await input.press('Enter');
  await expect(page.locator('#effortValue')).toHaveText('极高');
  await input.fill('/model '); await page.locator('.stage-header').click();
  await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(input).toHaveValue('/model ');
});

for (const [kind, providers, offline, title] of [
  ['offline', [], true, '本地服务未连接'],
  ['unconfigured', [], false, '先连接一个模型'],
  ['ready', [provider], false, '今天想聊点什么？']
]) {
  test(`空状态 ${kind} 准确引导`, async ({ page }) => {
    await load(page, { providers, offline });
    await expect(page.locator('.empty-title')).toHaveText(title);
    await expect(page.locator('.suggestion-card')).toHaveCount(kind === 'ready' ? 3 : 0);
    if (kind !== 'ready') await expect(page.locator('.empty-setup-link')).toHaveAttribute('href', '#/settings/providers');
  });
}

test('重名模型的显式选择列表可按 Enter 确认', async ({ page }) => {
  await load(page); const input = page.locator('#composerInput');
  await input.fill('/model same'); await input.press('Enter');
  await expect(page.locator('.command-panel-message')).toContainText('重复');
  await input.press('Enter'); await expect(page.locator('#modelValue')).toHaveText('same');
  await expect(input).toHaveValue('');
});

test('帮助支持键盘滚动并在 Escape 后恢复输入焦点', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 }); await load(page);
  await command(page, '/help'); await page.locator('#composerInput').press('PageDown');
  expect(await page.locator('.command-panel-host').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.locator('#composerInput').press('Escape');
  await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(page.locator('#composerInput')).toBeFocused();
});

test('输入指令时点击停止按钮只停止回复，不执行指令', async ({ page }) => {
  let release; let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/chat', async r => { calls++; await gate; await r.fulfill({ json: { choices: [{ message: { content: '结果' } }] } }); });
  await load(page); const input = page.locator('#composerInput');
  await input.fill('开始'); await page.locator('#sendBtn').click(); await expect.poll(() => calls).toBe(1);
  await input.fill('/effort high'); await page.locator('#sendBtn').click();
  await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  await expect(input).toHaveValue('/effort high'); await expect(page.locator('#effortValue')).toHaveText('中等'); release();
});

for (const scheme of ['light', 'dark']) {
  test(`默认 ${scheme} 辅助文字与选择项对比度至少 4.5`, async ({ page }) => {
    await load(page, { scheme }); await page.locator('#composerInput').fill('/');
    const ratios = await page.locator('.command-option-detail, .command-panel-hint, .composer-hint, .empty-lede').evaluateAll(elements => {
      const rgb = text => {
        const values = (text.match(/[\d.]+/g) || []).map(Number);
        return text.startsWith('color(srgb ') ? values.map((value, index) => index < 3 ? value * 255 : value) : values;
      };
      const blend = (front, back) => { const a = front[3] ?? 1; return front.slice(0, 3).map((v, i) => v * a + back[i] * (1 - a)); };
      const luminance = color => color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return elements.map(el => {
        const ancestors = []; let node = el;
        while (node) { ancestors.unshift(node); node = node.parentElement; }
        let background = [255, 255, 255];
        for (const ancestor of ancestors) background = blend(rgb(getComputedStyle(ancestor).backgroundColor), background);
        const style = getComputedStyle(el); const foreground = blend(rgb(style.color), background);
        const a = luminance(foreground), b = luminance(background);
        return { element: el.className, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), size: parseFloat(style.fontSize) };
      });
    });
    console.log(JSON.stringify({ scheme, minimumContrast: Math.min(...ratios.map(sample => sample.ratio)), samples: ratios }));
    for (const sample of ratios) { expect(sample.ratio).toBeGreaterThanOrEqual(4.5); expect(sample.size).toBeGreaterThanOrEqual(12); }
  });
}
