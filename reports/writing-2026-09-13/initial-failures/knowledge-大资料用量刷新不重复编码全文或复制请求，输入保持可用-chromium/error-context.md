# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: knowledge.spec.js >> 大资料用量刷新不重复编码全文或复制请求，输入保持可用
- Location: e2e/knowledge.spec.js:36:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#contextTooltip')
Expected substring: "固定项目资料"
Received string:    "上下文用量100% · 约 1048.7k / 116.3k Tokens系统提示词 · 约 2 Tokens项目资料 · 约 1048.6k Tokens历史与摘要 · 约 0 Tokens本次输入／附件 · 约 10 Tokens输出预留 · 约 8192 Tokens点击压缩历史"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('#contextTooltip')
    14 × locator resolved to <div role="tooltip" id="contextTooltip" class="context-tooltip is-open">…</div>
       - unexpected value "上下文用量100% · 约 1048.7k / 116.3k Tokens系统提示词 · 约 2 Tokens项目资料 · 约 1048.6k Tokens历史与摘要 · 约 0 Tokens本次输入／附件 · 约 10 Tokens输出预留 · 约 8192 Tokens点击压缩历史"

```

```yaml
- tooltip "上下文用量 100% · 约 1048.7k / 116.3k Tokens 系统提示词 · 约 2 Tokens 项目资料 · 约 1048.6k Tokens 历史与摘要 · 约 0 Tokens 本次输入／附件 · 约 10 Tokens 输出预留 · 约 8192 Tokens 点击压缩历史"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | const provider = { id: 'provider', displayName: '演示供应商', baseUrl: 'https://example.com/v1', responseFormat: 'openai-compatible', models: ['demo'], defaultModel: 'demo', contextWindow: 131072, maxTokens: 8192, hasKeyConfigured: true };
  3   | const material = '这是项目固定资料\n<script>window.knowledgeUnsafe = true</script>\n每次完整携带';
  4   | const file = { id: 'f', name: '项目资料与很长的文件名称用于测试布局.md', text: material, bytes: 0, updatedAt: 1 };
  5   | const history = [{ id: 'u', role: 'user', content: '旧问题', createdAt: 1 }, { id: 'a', role: 'assistant', content: '旧回答', createdAt: 2 }];
  6   | async function load(page, { files = [file], messages = [], config = {}, scheme = 'light', providerConfig = {} } = {}) {
  7   |   const seed = { settingsSchemaVersion: 1, chatConfig: { systemPrompt: '系统指令', streaming: false, autoCompress: false, ...config }, projects: [{ id: 'p', name: '研究项目' }, { id: 'q', name: '另一个项目' }],
  8   |     projectKnowledge: { p: files }, providers: [{ ...provider, ...providerConfig }], activeProviderId: provider.id, activeConversationId: 'c',
  9   |     conversations: [{ id: 'c', projectId: 'p', providerId: provider.id, model: 'demo', saveChats: true, messages }] };
  10  |   await page.addInitScript(({ seed, scheme }) => {
  11  |     if (!sessionStorage.getItem('knowledge-seeded')) { localStorage.setItem('tribblebook-v6-state', JSON.stringify(seed)); sessionStorage.setItem('knowledge-seeded', 'yes'); }
  12  |     localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'everforest', appearanceMode: scheme }));
  13  |   }, { seed, scheme });
  14  |   await page.route('**/api/health', route => route.fulfill({ json: { ok: true } }));
  15  |   await page.route('**/api/providers', route => route.fulfill({ json: { providers: [] } }));
  16  |   await page.route('**/api/providers/key*', route => route.fulfill({ json: { apiKey: 'fixture' } }));
  17  |   await page.goto('/#/chat');
  18  |   await expect(page.locator('#composerInput')).toBeEnabled();
  19  | }
  20  | async function send(page, text) { await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click(); }
  21  | async function library(page, id = 'p') {
  22  |   const modal = page.getByRole('dialog', { name: '项目设置', exact: true });
  23  |   if (await modal.isVisible()) await page.getByRole('button', { name: '关闭项目设置', exact: true }).click();
  24  |   if (page.viewportSize().width <= 1040 && !(await page.locator('#archiveDrawer').getAttribute('class')).includes('drawer-open')) {
  25  |     await page.locator(page.viewportSize().width > 720 ? '#railExpandBtn' : '#drawerToggleBtn').click();
  26  |     await expect(page.locator('#archiveDrawer')).toHaveClass(/drawer-open/);
  27  |   }
  28  |   const button = page.locator(`[data-project-id="${id}"] [data-project-action="menu"]`);
  29  |   await page.locator(`[data-project-id="${id}"] .project-row`).hover();
  30  |   await button.click();
  31  |   await expect(modal).toBeVisible(); await expect(page.locator('.knowledge-pane')).toBeVisible();
  32  |   await expect(page).toHaveURL(/#\/chat$/);
  33  |   await expect(page.locator('#knowledge-project')).toHaveCount(0);
  34  | }
  35  | 
  36  | test('大资料用量刷新不重复编码全文或复制请求，输入保持可用', async ({ page }) => {
  37  |   await page.addInitScript(() => {
  38  |     window.knowledgeWork = { encodes: 0, clones: 0 };
  39  |     const encode = TextEncoder.prototype.encode;
  40  |     TextEncoder.prototype.encode = function (text) {
  41  |       if (typeof text === 'string' && text.startsWith('large-knowledge-')) window.knowledgeWork.encodes++;
  42  |       return encode.call(this, text);
  43  |     };
  44  |     const clone = window.structuredClone;
  45  |     window.structuredClone = function (value, options) {
  46  |       if (value?.fixedContext?.length > 100000) window.knowledgeWork.clones++;
  47  |       return clone(value, options);
  48  |     };
  49  |   });
  50  |   const text = 'large-knowledge-' + 'x'.repeat(1024 * 1024 - 16);
  51  |   await load(page, { files: [{ ...file, id: 'large-a', text }, { ...file, id: 'large-b', text }] });
  52  |   await expect(page.locator('.knowledge-status')).toContainText('2 份');
  53  |   const before = await page.evaluate(() => ({ ...window.knowledgeWork }));
  54  |   for (let index = 0; index < 20; index++) await page.locator('#composerInput').fill(`快速编辑 ${index}`);
  55  |   await page.locator('#usageBtn').focus();
> 56  |   await expect(page.locator('#contextTooltip')).toContainText('固定项目资料');
      |                                                 ^ Error: expect(locator).toContainText(expected) failed
  57  |   expect(await page.evaluate(() => window.knowledgeWork)).toEqual(before);
  58  |   await expect(page.locator('#composerInput')).toHaveValue('快速编辑 19');
  59  | });
  60  | 
  61  | test('资料备份可恢复；取消恢复不改变项目资料', async ({ page }) => {
  62  |   await load(page); await library(page);
  63  |   const downloadPromise = page.waitForEvent('download');
  64  |   await page.getByRole('button', { name: '导出资料备份', exact: true }).click();
  65  |   const path = await (await downloadPromise).path();
  66  |   await page.getByLabel('替换项目资料', { exact: true }).setInputFiles({ name: '新资料.txt', mimeType: 'text/plain', buffer: Buffer.from('修改后的内容') });
  67  |   await expect(page.locator('.knowledge-feedback')).toContainText('已保存到本地');
  68  |   await page.getByLabel('恢复项目资料备份', { exact: true }).setInputFiles(path);
  69  |   await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  70  |   await expect(page.locator('.knowledge-feedback')).toContainText('已取消');
  71  |   await expect(page.locator('.knowledge-preview pre')).toHaveText('修改后的内容');
  72  |   await page.getByLabel('恢复项目资料备份', { exact: true }).setInputFiles(path);
  73  |   await page.getByRole('dialog').getByRole('button', { name: '替换资料', exact: true }).click();
  74  |   await expect(page.locator('.knowledge-feedback')).toContainText('已保存到本地');
  75  |   await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  76  |   await page.reload(); await library(page);
  77  |   await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  78  | });
  79  | 
  80  | test('全文预览安全，项目隔离，上传替换删除和刷新恢复', async ({ page }) => {
  81  |   await load(page);
  82  |   await library(page);
  83  |   await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  84  |   expect(await page.evaluate(() => window.knowledgeUnsafe)).toBeUndefined();
  85  |   await library(page, 'q');
  86  |   await expect(page.locator('.knowledge-list')).toContainText('尚未上传资料');
  87  |   await page.getByLabel('上传项目资料', { exact: true }).setInputFiles({ name: '新文件.txt', mimeType: 'text/plain', buffer: Buffer.from('新的资料') });
  88  |   await expect(page.locator('.knowledge-feedback')).toContainText('已保存到本地');
  89  |   await page.reload();
  90  |   await library(page, 'q');
  91  |   await expect(page.locator('.knowledge-preview pre')).toHaveText('新的资料');
  92  |   await page.getByLabel('替换项目资料', { exact: true }).setInputFiles({ name: '替换.md', mimeType: 'text/markdown', buffer: Buffer.from('替换后的全文') });
  93  |   await expect(page.locator('.knowledge-preview pre')).toHaveText('替换后的全文');
  94  |   await page.getByRole('button', { name: '删除文件', exact: true }).click();
  95  |   await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  96  |   await expect(page.locator('.knowledge-list')).toContainText('尚未上传资料');
  97  |   await library(page, 'p');
  98  |   await expect(page.locator('.knowledge-preview pre')).toHaveText(material);
  99  | });
  100 | 
  101 | test('每次正式请求完整注入，历史压缩请求不含项目资料', async ({ page }) => {
  102 |   const chats = []; const compacts = [];
  103 |   await page.route('**/api/chat', route => { chats.push(route.request().postDataJSON()); return route.fulfill({ json: { content: '演示回复' } }); });
  104 |   await page.route('**/api/chat/compress', route => { compacts.push(route.request().postDataJSON()); return route.fulfill({ json: { summary: '历史摘要' } }); });
  105 |   await load(page, { messages: history });
  106 |   await send(page, '/compact');
  107 |   await expect.poll(() => compacts.length).toBe(1);
  108 |   expect(JSON.stringify(compacts[0])).not.toContain('项目固定资料');
  109 |   await expect(page.locator('#composerInput')).toHaveValue('');
  110 |   await send(page, '第一个新问题');
  111 |   await expect.poll(() => chats.length).toBe(1);
  112 |   await expect(page.locator('#sendBtn')).not.toHaveClass(/is-stop/);
  113 |   await send(page, '第二个新问题');
  114 |   await expect.poll(() => chats.length).toBe(2);
  115 |   for (const body of chats) {
  116 |     expect(body.chatConfig.systemPrompt).toContain('系统指令');
  117 |     expect(JSON.parse(body.chatConfig.systemPrompt.split('：\n')[1])[0].text).toBe(material);
  118 |     expect(JSON.stringify(body.messages)).not.toContain('/compact');
  119 |     expect(body.contextSummary).toBe('历史摘要');
  120 |   }
  121 | });
  122 | 
  123 | for (const missing of [true, false]) test(missing ? '缺失资料阻止发送且草稿保留' : '固定资料超预算不发起自动压缩，附件和草稿保留', async ({ page }) => {
  124 |   let requests = 0;
  125 |   await page.route('**/api/chat**', route => { requests++; return route.fulfill({ json: {} }); });
  126 |   await load(page, { files: [{ ...file, text: missing ? null : '长资料'.repeat(5000) }], messages: history, providerConfig: { contextWindow: 4000, maxTokens: 1000 } });
  127 |   await page.locator('#attachmentInput').setInputFiles({ name: '附件.txt', mimeType: 'text/plain', buffer: Buffer.from('附件') });
  128 |   await send(page, '保留我的问题');
  129 |   await expect(page.getByText(missing ? /正文缺失或损坏/ : /固定资料、系统提示词与本次输入已超过/).first()).toBeVisible();
  130 |   await expect(page.locator('#composerInput')).toHaveValue('保留我的问题');
  131 |   await expect(page.locator('#composerChips')).toContainText('附件.txt');
  132 |   expect(requests).toBe(0);
  133 | });
  134 | 
  135 | for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) test(`资料界面 ${scheme} ${width} 无横向溢出`, async ({ page }, testInfo) => {
  136 |   await page.setViewportSize({ width, height: 900 });
  137 |   await load(page, { scheme }); await library(page);
  138 |   await expect(page.locator('.knowledge-preview pre')).toBeVisible();
  139 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  140 |   await page.screenshot({ path: testInfo.outputPath(`knowledge-${scheme}-${width}.png`), fullPage: true, animations: 'disabled' });
  141 | });
  142 | 
  143 | test('项目浮窗键盘、名称校验、删除取消和设置入口清理', async ({ page }) => {
  144 |   await load(page); await page.locator('#composerInput').fill('保留输入'); await library(page);
  145 |   const modal = page.getByRole('dialog', { name: '项目设置', exact: true });
  146 |   await expect(page.getByRole('button', { name: '关闭项目设置', exact: true })).toBeFocused();
  147 |   await page.getByLabel('项目名称', { exact: true }).fill('   ');
  148 |   await page.getByRole('button', { name: '保存名称', exact: true }).click();
  149 |   await expect(modal.getByRole('alert')).toHaveText('项目名称不能为空');
  150 |   await page.getByLabel('项目名称', { exact: true }).fill('名'.repeat(61));
  151 |   await page.getByRole('button', { name: '保存名称', exact: true }).click();
  152 |   await expect(modal.getByRole('alert')).toHaveText('项目名称不能超过 60 个字符');
  153 |   await page.getByLabel('项目名称', { exact: true }).fill('中文项目');
  154 |   await page.getByLabel('项目名称', { exact: true }).dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  155 |   await expect(page.locator('[data-project-id="p"] .project-toggle')).toContainText('研究项目');
  156 |   await page.getByRole('button', { name: '删除项目', exact: true }).click();
```