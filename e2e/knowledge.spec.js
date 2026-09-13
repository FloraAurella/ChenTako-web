import { test, expect } from '@playwright/test';
const provider = { id: 'provider', displayName: '演示供应商', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['demo'], defaultModel: 'demo', contextWindow: 131072, maxTokens: 8192, hasKeyConfigured: true };
const material = '这是项目固定资料\n<script>window.knowledgeUnsafe = true</script>\n每次完整携带';
const file = { id: 'f', name: '项目资料与很长的文件名称用于测试布局.md', text: material, bytes: 0, updatedAt: 1 };
const history = [{ id: 'u', role: 'user', content: '旧问题', createdAt: 1 }, { id: 'a', role: 'assistant', content: '旧回答', createdAt: 2 }];
async function load(page, { files = [file], messages = [], config = {}, scheme = 'light', providerConfig = {} } = {}) {
  const seed = { settingsSchemaVersion: 1, chatConfig: { systemPrompt: '系统指令', streaming: false, autoCompress: false, ...config }, projects: [{ id: 'p', name: '研究项目' }, { id: 'q', name: '另一个项目' }],
    projectKnowledge: { p: files }, providers: [{ ...provider, ...providerConfig }], activeProviderId: provider.id, activeConversationId: 'c',
    conversations: [{ id: 'c', projectId: 'p', providerId: provider.id, model: 'demo', saveChats: true, messages }] };
  await page.addInitScript(({ seed, scheme }) => {
    if (!sessionStorage.getItem('knowledge-seeded')) { localStorage.setItem('tribblebook-v6-state', JSON.stringify(seed)); sessionStorage.setItem('knowledge-seeded', 'yes'); }
    localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'everforest', appearanceMode: scheme }));
  }, { seed, scheme });
  await page.route('**/api/health', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/providers', route => route.fulfill({ json: { providers: [] } }));
  await page.route('**/api/providers/key*', route => route.fulfill({ json: { apiKey: 'fixture' } }));
  await page.goto('/#/chat');
  await expect(page.locator('#composerInput')).toBeEnabled();
}
async function send(page, text) { await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click(); }
async function library(page, id = 'p') {
  const modal = page.getByRole('dialog', { name: '项目设置', exact: true });
  if (await modal.isVisible()) await page.getByRole('button', { name: '关闭项目设置', exact: true }).click();
  if (page.viewportSize().width <= 1040 && !(await page.locator('#archiveDrawer').getAttribute('class')).includes('drawer-open')) {
    await page.locator(page.viewportSize().width > 720 ? '#railExpandBtn' : '#drawerToggleBtn').click();
    await expect(page.locator('#archiveDrawer')).toHaveClass(/drawer-open/);
  }
  const button = page.locator(`[data-project-id="${id}"] [data-project-action="menu"]`);
  await page.locator(`[data-project-id="${id}"] .project-row`).hover();
  await button.click();
  await expect(modal).toBeVisible(); await expect(page.locator('.knowledge-pane')).toBeVisible();
  await expect(page).toHaveURL(/#\/chat$/);
  await expect(page.locator('#knowledge-project')).toHaveCount(0);
}

test('大资料用量刷新不重复编码全文或复制请求，输入保持可用', async ({ page }) => {
  await page.addInitScript(() => {
    window.knowledgeWork = { encodes: 0, clones: 0 };
    const encode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function (text) {
      if (typeof text === 'string' && text.startsWith('large-knowledge-')) window.knowledgeWork.encodes++;
      return encode.call(this, text);
    };
    const clone = window.structuredClone;
    window.structuredClone = function (value, options) {
      if (value?.fixedContext?.length > 100000) window.knowledgeWork.clones++;
      return clone(value, options);
    };
  });
  const text = 'large-knowledge-' + 'x'.repeat(1024 * 1024 - 16);
  await load(page, { files: [{ ...file, id: 'large-a', text }, { ...file, id: 'large-b', text }] });
  await expect(page.locator('.knowledge-status')).toContainText('2 份');
  const before = await page.evaluate(() => ({ ...window.knowledgeWork }));
  for (let index = 0; index < 20; index++) await page.locator('#composerInput').fill(`快速编辑 ${index}`);
  await page.locator('#usageBtn').focus();
  await expect(page.locator('#contextTooltip')).toContainText('固定项目资料');
  expect(await page.evaluate(() => window.knowledgeWork)).toEqual(before);
  await expect(page.locator('#composerInput')).toHaveValue('快速编辑 19');
});

test('资料备份可恢复；取消恢复不改变项目资料', async ({ page }) => {
  await load(page); await library(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出资料备份', exact: true }).click();
  const path = await (await downloadPromise).path();
  await page.getByLabel('替换项目资料', { exact: true }).setInputFiles({ name: '新资料.txt', mimeType: 'text/plain', buffer: Buffer.from('修改后的内容') });
  await expect(page.locator('.knowledge-feedback')).toContainText('已保存到本地');
  await page.getByLabel('恢复项目资料备份', { exact: true }).setInputFiles(path);
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.knowledge-feedback')).toContainText('已取消');
  await expect(page.locator('.knowledge-preview pre')).toHaveText('修改后的内容');
  await page.getByLabel('恢复项目资料备份', { exact: true }).setInputFiles(path);
  await page.getByRole('dialog').getByRole('button', { name: '替换资料', exact: true }).click();
  await expect(page.locator('.knowledge-feedback')).toContainText('已保存到本地');
  await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  await page.reload(); await library(page);
  await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
});

test('全文预览安全，项目隔离，上传替换删除和刷新恢复', async ({ page }) => {
  await load(page);
  await library(page);
  await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  expect(await page.evaluate(() => window.knowledgeUnsafe)).toBeUndefined();
  await library(page, 'q');
  await expect(page.locator('.knowledge-list')).toContainText('尚未上传资料');
  await page.getByLabel('上传项目资料', { exact: true }).setInputFiles({ name: '新文件.txt', mimeType: 'text/plain', buffer: Buffer.from('新的资料') });
  await expect(page.locator('.knowledge-feedback')).toContainText('已保存到本地');
  await page.reload();
  await library(page, 'q');
  await expect(page.locator('.knowledge-preview pre')).toHaveText('新的资料');
  await page.getByLabel('替换项目资料', { exact: true }).setInputFiles({ name: '替换.md', mimeType: 'text/markdown', buffer: Buffer.from('替换后的全文') });
  await expect(page.locator('.knowledge-preview pre')).toHaveText('替换后的全文');
  await page.getByRole('button', { name: '删除文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.knowledge-list')).toContainText('尚未上传资料');
  await library(page, 'p');
  await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
});

test('每次正式请求完整注入，历史压缩请求不含项目资料', async ({ page }) => {
  const chats = []; const compacts = [];
  await page.route('**/api/chat', route => { chats.push(route.request().postDataJSON()); return route.fulfill({ json: { content: '演示回复' } }); });
  await page.route('**/api/chat/compress', route => { compacts.push(route.request().postDataJSON()); return route.fulfill({ json: { summary: '历史摘要' } }); });
  await load(page, { messages: history });
  await send(page, '/compact');
  await expect.poll(() => compacts.length).toBe(1);
  expect(JSON.stringify(compacts[0])).not.toContain('项目固定资料');
  await expect(page.locator('#composerInput')).toHaveValue('');
  await send(page, '第一个新问题');
  await expect.poll(() => chats.length).toBe(1);
  await expect(page.locator('#sendBtn')).not.toHaveClass(/is-stop/);
  await send(page, '第二个新问题');
  await expect.poll(() => chats.length).toBe(2);
  for (const body of chats) {
    expect(body.chatConfig.systemPrompt).toContain('系统指令');
    expect(JSON.parse(body.chatConfig.systemPrompt.split('：\n')[1])[0].text).toBe(material);
    expect(JSON.stringify(body.messages)).not.toContain('/compact');
    expect(body.contextSummary).toBe('历史摘要');
  }
});

for (const missing of [true, false]) test(missing ? '缺失资料阻止发送且草稿保留' : '固定资料超预算不发起自动压缩，附件和草稿保留', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/chat**', route => { requests++; return route.fulfill({ json: {} }); });
  await load(page, { files: [{ ...file, text: missing ? null : '长资料'.repeat(5000) }], messages: history, providerConfig: { contextWindow: 4000, maxTokens: 1000 } });
  await page.locator('#attachmentInput').setInputFiles({ name: '附件.txt', mimeType: 'text/plain', buffer: Buffer.from('附件') });
  await send(page, '保留我的问题');
  await expect(page.getByText(missing ? /正文缺失或损坏/ : /固定资料、系统提示词与本次输入已超过/).first()).toBeVisible();
  await expect(page.locator('#composerInput')).toHaveValue('保留我的问题');
  await expect(page.locator('#composerChips')).toContainText('附件.txt');
  expect(requests).toBe(0);
});

for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) test(`资料界面 ${scheme} ${width} 无横向溢出`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await load(page, { scheme }); await library(page);
  await expect(page.locator('.knowledge-preview pre')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`knowledge-${scheme}-${width}.png`), fullPage: true, animations: 'disabled' });
});

test('项目浮窗键盘、名称校验、删除取消和设置入口清理', async ({ page }) => {
  await load(page); await page.locator('#composerInput').fill('保留输入'); await library(page);
  const modal = page.getByRole('dialog', { name: '项目设置', exact: true });
  await expect(page.getByRole('button', { name: '关闭项目设置', exact: true })).toBeFocused();
  await page.getByLabel('项目名称', { exact: true }).fill('   ');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(modal.getByRole('alert')).toHaveText('项目名称不能为空');
  await page.getByLabel('项目名称', { exact: true }).fill('名'.repeat(61));
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(modal.getByRole('alert')).toHaveText('项目名称不能超过 60 个字符');
  await page.getByLabel('项目名称', { exact: true }).fill('中文项目');
  await page.getByLabel('项目名称', { exact: true }).dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(page.locator('[data-project-id="p"] .project-toggle')).toContainText('研究项目');
  await page.getByRole('button', { name: '删除项目', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '删除项目', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible(); await expect(modal.getByRole('button', { name: '删除项目', exact: true })).toBeFocused();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    expect(await modal.evaluate(e => e.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(page.locator('[data-project-id="p"] [data-project-action="menu"]')).toBeFocused();
  await expect(page.locator('#composerInput')).toHaveValue('保留输入');
  await library(page, 'q'); await page.keyboard.press('Escape');
  await page.goto('/#/settings');
  await expect(page.locator('.settings-index')).toBeVisible();
  await expect(page.locator('.settings-index')).not.toContainText('项目知识库');
  await page.getByLabel('搜索设置').fill('知识库');
  await expect(page.locator('.settings-nav-item:visible')).toHaveCount(0);
});

test('读取中关闭并打开其他项目，迟到的文件结果不能写入任何项目', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      if (this.name !== 'slow.txt') return read.call(this);
      return new Promise(resolve => { window.finishKnowledgeRead = () => read.call(this).then(resolve); });
    };
  });
  await library(page);
  await page.getByLabel('上传项目资料', { exact: true }).setInputFiles({ name: 'slow.txt', mimeType: 'text/plain', buffer: Buffer.from('不应写入') });
  await expect(page.locator('.knowledge-feedback')).toContainText('正在读取与保存');
  await expect(page.getByRole('button', { name: '上传资料', exact: true })).toBeDisabled();
  await library(page, 'q');
  await page.evaluate(() => window.finishKnowledgeRead());
  await expect(page.locator('.knowledge-list')).toContainText('尚未上传资料');
  await library(page, 'p');
  await expect(page.locator('.knowledge-list')).not.toContainText('slow.txt');
  await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
});

test('文件错误和双存储失败明确提示，当前资料仍可备份', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); });
  await load(page); await library(page);
  await page.getByLabel('上传项目资料', { exact: true }).setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from([0, 255, 0, 1]) });
  await expect(page.locator('.knowledge-feedback')).toHaveAttribute('role', 'alert');
  await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage) throw new DOMException('full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await page.getByLabel('上传项目资料', { exact: true }).setInputFiles({ name: '保存失败.txt', mimeType: 'text/plain', buffer: Buffer.from('页面仍保留正文') });
  await expect(page.locator('.knowledge-feedback')).toContainText('持久化失败');
  await page.getByRole('button', { name: /保存失败.txt/ }).click();
  await expect(page.locator('.knowledge-preview pre')).toHaveText('页面仍保留正文');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出资料备份', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('project-knowledge.json');
});
