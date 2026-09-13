# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commands.spec.js >> 生成期间配置修改只影响下一次请求，停止按钮保持原行为
- Location: e2e/commands.spec.js:130:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('#modelValue')
Expected: "model-b"
Received: "model-a"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('#modelValue')
    14 × locator resolved to <span id="modelValue" class="runtime-model">model-a</span>
       - unexpected value "model-a"

```

```yaml
- text: model-a
```

# Test source

```ts
  38  |   await page.locator('#attachmentInput').setInputFiles({ name: '资料.txt', mimeType: 'text/plain', buffer: Buffer.from('资料正文') });
  39  |   await command(page, '/help');
  40  |   await expect(page.locator('.command-help')).toContainText('//model');
  41  |   await expect(page.locator('#composerInput')).toHaveValue('');
  42  |   await expect(page.locator('#composerChips')).toContainText('资料.txt');
  43  |   await page.locator('#composerInput').press('Escape');
  44  |   await command(page, '/unknown');
  45  |   await expect(page.locator('.command-feedback')).toContainText('未知指令');
  46  |   await expect(page.locator('#composerInput')).toHaveValue('/unknown');
  47  |   expect(requests).toBe(0);
  48  | });
  49  | 
  50  | test('补全、中文搜索、参数选择、恢复跟随配置', async ({ page }) => {
  51  |   await load(page);
  52  |   const input = page.locator('#composerInput');
  53  |   await input.fill('/思考'); await expect(page.getByRole('option')).toHaveCount(1);
  54  |   await input.press('Tab'); await expect(input).toHaveValue('/effort ');
  55  |   await page.getByRole('option', { name: /高 high/ }).click();
  56  |   await expect(page.locator('#effortValue')).toHaveText('高');
  57  |   await expect(input).toBeFocused();
  58  |   await command(page, '/effort 跟随配置');
  59  |   await expect(page.locator('#effortValue')).toHaveText('中等');
  60  |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').reasoningEffortOverride).toBeNull();
  61  | });
  62  | 
  63  | test('模型重名要求选择供应商，禁用模型隐藏，快捷参数与按钮一致', async ({ page }) => {
  64  |   await load(page);
  65  |   await command(page, '/model same');
  66  |   await expect(page.getByRole('option')).toHaveCount(2);
  67  |   await page.getByRole('option', { name: /供应商 B/ }).click();
  68  |   await expect(page.locator('#modelValue')).toHaveText('same');
  69  |   await expect.poll(async () => (await saved(page)).activeProviderId).toBe('b');
  70  |   await command(page, '/model');
  71  |   await expect(page.locator('.command-panel')).not.toContainText('hidden-model');
  72  |   await page.locator('#composerInput').press('Escape');
  73  |   await command(page, '/model model-b');
  74  |   await expect(page.locator('#modelValue')).toHaveText('model-b');
  75  |   await page.locator('#runtimeBtn').click();
  76  |   await page.locator('[data-runtime-open="model"]').click();
  77  |   await page.locator('[data-provider-id="a"][data-model="model-a"]').click();
  78  |   await expect(page.locator('#modelValue')).toHaveText('model-a');
  79  | });
  80  | 
  81  | test('部分模型名不会自动执行，无效参数保持输入', async ({ page }) => {
  82  |   await load(page); await command(page, '/model model-');
  83  |   await expect(page.getByRole('option')).toHaveCount(2);
  84  |   await expect(page.locator('#modelValue')).toHaveText('model-a');
  85  |   await page.locator('#composerInput').press('Escape');
  86  |   await command(page, '/effort wrong');
  87  |   await expect(page.locator('.command-feedback')).toContainText('无效强度');
  88  |   await expect(page.locator('#composerInput')).toHaveValue('/effort wrong');
  89  |   await command(page, '/help extra'); await expect(page.locator('.command-feedback')).toContainText('不接受参数');
  90  | });
  91  | 
  92  | test('压缩首次补全不执行，重复请求受阻，新草稿不会被清除', async ({ page }) => {
  93  |   let calls = 0; let release;
  94  |   const gate = new Promise(resolve => { release = resolve; });
  95  |   await page.route('**/api/chat/compress', async route => { calls++; await gate; await route.fulfill({ json: { summary: '压缩摘要' } }); });
  96  |   await load(page, { messages: history });
  97  |   const input = page.locator('#composerInput');
  98  |   await input.fill('/comp'); await input.press('Enter');
  99  |   await expect(input).toHaveValue('/compact'); expect(calls).toBe(0);
  100 |   await input.press('Enter'); await expect.poll(() => calls).toBe(1);
  101 |   await input.fill('/compact'); await page.locator('#sendBtn').click();
  102 |   await expect(page.locator('.command-feedback')).toContainText('等待完成');
  103 |   await input.fill('稍后发送的新草稿'); release();
  104 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('压缩摘要');
  105 |   await expect(input).toHaveValue('稍后发送的新草稿'); expect(calls).toBe(1);
  106 | });
  107 | 
  108 | test('空历史保留指令', async ({ page }) => {
  109 |   await load(page);
  110 |   await command(page, '/compact'); await expect(page.locator('.command-feedback')).toContainText('没有可压缩');
  111 |   await expect(page.locator('#composerInput')).toHaveValue('/compact');
  112 | });
  113 | 
  114 | test('字面量、多行和正文斜杠进入普通消息，指令不进入 Prompt 或标题', async ({ page }) => {
  115 |   const bodies = [];
  116 |   await page.route('**/api/chat', async r => { bodies.push(r.request().postDataJSON()); await r.fulfill({ json: { choices: [{ message: { content: '回答' } }] } }); });
  117 |   await load(page);
  118 |   await command(page, '/effort high');
  119 |   for (const [text, sent] of [['//model', '/model'], ['正文 /effort', '正文 /effort'], ['/model\n这是一段文本', '/model\n这是一段文本']]) {
  120 |     await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click();
  121 |     await expect.poll(() => bodies.length).toBe([ '//model', '正文 /effort', '/model\n这是一段文本' ].indexOf(text) + 1);
  122 |     await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  123 |     expect(bodies.at(-1).messages.filter(m => m.role === 'user').at(-1).content).toBe(sent);
  124 |   }
  125 |   expect(bodies[0].reasoningEffort).toBe('high');
  126 |   expect(bodies.flatMap(b => b.messages).some(m => m.content === '/effort high')).toBe(false);
  127 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').title).toBe('/model');
  128 | });
  129 | 
  130 | test('生成期间配置修改只影响下一次请求，停止按钮保持原行为', async ({ page }) => {
  131 |   const bodies = []; let release;
  132 |   const gate = new Promise(resolve => { release = resolve; });
  133 |   await page.route('**/api/chat', async r => { bodies.push(r.request().postDataJSON()); if (bodies.length === 1) await gate; await r.fulfill({ json: { choices: [{ message: { content: '完成' } }] } }); });
  134 |   await load(page);
  135 |   const input = page.locator('#composerInput');
  136 |   await input.fill('第一轮'); await page.locator('#sendBtn').click(); await expect.poll(() => bodies.length).toBe(1);
  137 |   await input.fill('/model model-b'); await input.press('Enter');
> 138 |   await expect(page.locator('#modelValue')).toHaveText('model-b');
      |                                             ^ Error: expect(locator).toHaveText(expected) failed
  139 |   await input.fill('/effort high'); await input.press('Enter');
  140 |   await expect(page.locator('#effortValue')).toHaveText('高');
  141 |   await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '停止生成');
  142 |   expect(bodies[0].model).toBe('model-a'); expect(bodies[0].reasoningEffort).toBe('medium');
  143 |   release(); await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  144 |   await input.fill('第二轮'); await page.locator('#sendBtn').click(); await expect.poll(() => bodies.length).toBe(2);
  145 |   expect(bodies[1].model).toBe('model-b'); expect(bodies[1].reasoningEffort).toBe('high');
  146 | });
  147 | 
  148 | test('输入法确认不会执行指令，关闭和会话切换保留草稿', async ({ page }) => {
  149 |   await load(page);
  150 |   const input = page.locator('#composerInput');
  151 |   await input.fill('/effort high');
  152 |   await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  153 |   await expect(page.locator('#effortValue')).toHaveText('中等');
  154 |   await input.press('Escape'); await expect(input).toHaveValue('/effort high');
  155 |   await input.fill('/model '); await expect(page.locator('.command-panel')).toBeVisible();
  156 |   await page.locator('[data-conversation-id="other"]').click();
  157 |   await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(input).toHaveValue('另一份草稿');
  158 |   await page.locator('[data-conversation-id="c"]').click(); await expect(input).toHaveValue('/model ');
  159 | });
  160 | 
  161 | for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  162 |   test(`指令面板 ${scheme} ${width} 无溢出且 panel 悬停稳定`, async ({ page }, testInfo) => {
  163 |     await page.setViewportSize({ width, height: 840 }); await load(page, { scheme });
  164 |     await page.locator('#composerInput').fill('/');
  165 |     const panel = page.locator('.command-panel'); await expect(panel).toBeVisible();
  166 |     await expect(page.locator('.command-option-title')).toHaveText(['模型', '思考强度', '压缩历史', '帮助']);
  167 |     await expect(page.locator('.command-option-icon svg')).toHaveCount(4);
  168 |     await expect(page.locator('#composerInput')).toBeFocused();
  169 |     expect(await page.locator('#composerInput').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
  170 |     expect(await page.locator('#composerInput').evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  171 |     const paint = el => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderColor]; };
  172 |     const before = await panel.evaluate(paint); await panel.hover(); expect(await panel.evaluate(paint)).toEqual(before);
  173 |     const rect = await panel.boundingBox(); const input = await page.locator('#composerInput').boundingBox();
  174 |     expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(width);
  175 |     expect(rect.y + rect.height).toBeLessThanOrEqual(input.y);
  176 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  177 |     await page.mouse.move(0, 0);
  178 |     await page.screenshot({ path: testInfo.outputPath(`commands-${scheme}-${width}.png`) });
  179 |     await panel.screenshot({ path: testInfo.outputPath(`menu-${scheme}-${width}.png`) });
  180 |   });
  181 | }
  182 | 
  183 | test('发送准备时切换按钮模型，自动压缩和随后发送仍使用原请求快照', async ({ page }) => {
  184 |   const messages = Array.from({ length: 4 }, (_, i) => [
  185 |     { id: `u${i}`, role: 'user', content: '历史内容'.repeat(100) },
  186 |     { id: `a${i}`, role: 'assistant', content: '历史回复'.repeat(100) }
  187 |   ]).flat();
  188 |   let compressed; let sent; let release;
  189 |   const gate = new Promise(resolve => { release = resolve; });
  190 |   await page.route('**/api/chat/compress', async r => { compressed = r.request().postDataJSON(); await gate; await r.fulfill({ json: { summary: '简短历史摘要' } }); });
  191 |   await page.route('**/api/chat', async r => { sent = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { content: '继续' } }] } }); });
  192 |   await load(page, { providers: [{ ...provider, contextWindow: 6000, maxTokens: 1000 }, second, disabled], messages, config: { compressionThreshold: 10 } });
  193 |   await page.locator('#composerInput').fill('接着讲'); await page.locator('#sendBtn').click();
  194 |   await expect.poll(() => Boolean(compressed)).toBe(true);
  195 |   await page.locator('#runtimeBtn').click(); await page.locator('[data-runtime-open="model"]').click();
  196 |   await page.locator('[data-provider-id="a"][data-model="model-b"]').click();
  197 |   await expect(page.locator('#modelValue')).toHaveText('model-b'); release();
  198 |   await expect.poll(() => Boolean(sent)).toBe(true);
  199 |   expect(compressed.model).toBe('model-a'); expect(sent.model).toBe('model-a');
  200 |   expect(sent.reasoningEffort).toBe('medium');
  201 |   await expect(page.locator('#modelValue')).toHaveText('model-b');
  202 | });
  203 | 
  204 | test('压缩失败保留指令和附件且不创建普通指令消息', async ({ page }) => {
  205 |   await page.route('**/api/chat/compress', r => r.fulfill({ status: 500, json: { error: '模拟服务失败' } }));
  206 |   await load(page, { messages: history });
  207 |   await page.locator('#attachmentInput').setInputFiles({ name: '保留.txt', mimeType: 'text/plain', buffer: Buffer.from('本地资料') });
  208 |   await command(page, '/compact');
  209 |   await expect(page.locator('.command-feedback')).toContainText('未完成');
  210 |   await expect(page.locator('#composerInput')).toHaveValue('/compact');
  211 |   await expect(page.locator('#composerChips')).toContainText('保留.txt');
  212 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').messages.filter(m => m.role === 'user').length).toBe(2);
  213 | });
  214 | 
  215 | test('异步压缩完成后不修改其他会话草稿', async ({ page }) => {
  216 |   let release; let calls = 0;
  217 |   const gate = new Promise(resolve => { release = resolve; });
  218 |   await page.route('**/api/chat/compress', async r => { calls++; await gate; await r.fulfill({ json: { summary: '摘要' } }); });
  219 |   await load(page, { messages: history }); await command(page, '/compact');
  220 |   await expect.poll(() => calls).toBe(1);
  221 |   await page.locator('[data-conversation-id="other"]').click(); release();
  222 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('摘要');
  223 |   await expect(page.locator('#composerInput')).toHaveValue('另一份草稿');
  224 |   await expect(page.locator('.command-feedback')).toBeHidden();
  225 | });
  226 | 
  227 | test('参数 Tab 只补全，方向键 Enter 选择，点击外部保留输入', async ({ page }) => {
  228 |   await load(page); const input = page.locator('#composerInput');
  229 |   await input.fill('/effort hi'); await input.press('Tab');
  230 |   await expect(input).toHaveValue('/effort high'); await expect(page.locator('#effortValue')).toHaveText('中等');
  231 |   await input.press('Enter'); await expect(page.locator('#effortValue')).toHaveText('高');
  232 |   await input.fill('/effort '); await input.press('ArrowDown'); await input.press('Enter');
  233 |   await expect(page.locator('#effortValue')).toHaveText('极高');
  234 |   await input.fill('/model '); await page.locator('.stage-header').click();
  235 |   await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(input).toHaveValue('/model ');
  236 | });
  237 | 
  238 | for (const [kind, providers, offline, title] of [
```