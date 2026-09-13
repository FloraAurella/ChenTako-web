# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commands.spec.js >> 指令面板 dark 1280 无溢出且 panel 悬停稳定
- Location: e2e/commands.spec.js:192:3

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('.command-option-title')
Timeout: 5000ms
- Expected  - 0
+ Received  + 4

  Array [
    "模型",
    "思考强度",
    "压缩历史",
+   "创建章节",
+   "讨论",
+   "写作",
+   "编辑",
    "帮助",
  ]

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.command-option-title')
    14 × locator resolved to 8 elements

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e4]:
    - complementary "对话" [ref=e5]:
      - generic [ref=e6]:
        - heading "ChenTako" [level=2] [ref=e13]
        - button "收起侧栏" [expanded] [ref=e15] [cursor=pointer]
      - button "新建对话" [ref=e19] [cursor=pointer]
      - generic [ref=e23]:
        - generic [ref=e24]: 查找聊天
        - button "搜索对话" [ref=e25] [cursor=pointer]
        - button "导入对话" [ref=e29] [cursor=pointer]
      - searchbox "搜索对话 ⌘K" [ref=e33]
      - generic [ref=e34]:
        - region "项目" [ref=e35]:
          - generic [ref=e36]:
            - button "项目" [expanded] [ref=e37] [cursor=pointer]
            - button "新建项目" [ref=e41] [cursor=pointer]
          - generic [ref=e45]: 创建项目，整理相关聊天
        - region "聊天" [ref=e47]:
          - button "聊天" [expanded] [ref=e49] [cursor=pointer]
          - generic [ref=e53]:
            - button "未命名对话 今天" [ref=e54] [cursor=pointer]:
              - generic [ref=e55]: 未命名对话
              - generic [ref=e57]: 今天
            - button "另一个会话 今天" [ref=e59] [cursor=pointer]:
              - generic [ref=e60]: 另一个会话
              - generic [ref=e62]: 今天
      - navigation "应用导航" [ref=e64]:
        - button "设置" [ref=e65] [cursor=pointer]
    - main [ref=e70]:
      - generic [ref=e71]:
        - generic [ref=e73]:
          - generic [ref=e74]: Chat · 对话
          - generic [ref=e75]: 新对话
        - generic "本地服务正常" [ref=e78]
      - region "对话" [ref=e82]:
        - heading "欢迎回来，随时开始吧" [level=2] [ref=e92]
        - generic [ref=e94]:
          - button "当前项目：无项目" [ref=e96] [cursor=pointer]:
            - generic [ref=e100]: 无项目
          - generic [ref=e104]:
            - textbox "输入消息，/ 打开指令" [active] [ref=e106]: /
            - generic [ref=e107]:
              - button "添加附件" [ref=e108] [cursor=pointer]
              - generic [ref=e111]:
                - button "model-a 中等" [ref=e112] [cursor=pointer]:
                  - generic [ref=e113]: model-a
                  - generic [ref=e114]: 中等
                - button "压缩上下文（已用约 0%）" [ref=e118] [cursor=pointer]
                - button "发送" [ref=e123] [cursor=pointer]
          - generic [ref=e126]: Enter 发送 · Shift + Enter 换行
  - generic "指令" [ref=e128]:
    - listbox "指令" [ref=e129]:
      - option "模型 切换当前会话模型 · model-a" [selected] [ref=e130] [cursor=pointer]:
        - generic [ref=e137]:
          - generic "/model" [ref=e138]: 模型
          - generic [ref=e139]: 切换当前会话模型 · model-a
      - option "思考强度 调整思考强度或恢复跟随配置 · medium · 跟随配置" [ref=e140] [cursor=pointer]:
        - generic [ref=e145]:
          - generic "/effort" [ref=e146]: 思考强度
          - generic [ref=e147]: 调整思考强度或恢复跟随配置 · medium · 跟随配置
      - option "压缩历史 没有可压缩的已完成历史。" [disabled] [ref=e148] [cursor=pointer]:
        - generic [ref=e153]:
          - generic "/compact" [ref=e154]: 压缩历史
          - generic [ref=e155]: 没有可压缩的已完成历史。
      - option "创建章节 创建并选中空章节" [ref=e156] [cursor=pointer]:
        - generic [ref=e160]:
          - generic "/create" [ref=e161]: 创建章节
          - generic [ref=e162]: 创建并选中空章节
      - option "讨论 切换讨论模式，可附带要求" [ref=e163] [cursor=pointer]:
        - generic [ref=e167]:
          - generic "/chat" [ref=e168]: 讨论
          - generic [ref=e169]: 切换讨论模式，可附带要求
      - option "写作 切换写作模式，可附带要求" [ref=e170] [cursor=pointer]:
        - generic [ref=e174]:
          - generic "/write" [ref=e175]: 写作
          - generic [ref=e176]: 切换写作模式，可附带要求
      - option "编辑 切换编辑模式，可附带要求" [ref=e177] [cursor=pointer]:
        - generic [ref=e181]:
          - generic "/edit" [ref=e182]: 编辑
          - generic [ref=e183]: 切换编辑模式，可附带要求
      - option "帮助 查看指令帮助" [ref=e184] [cursor=pointer]:
        - generic [ref=e188]:
          - generic "/help" [ref=e189]: 帮助
          - generic [ref=e190]: 查看指令帮助
```

# Test source

```ts
  96  |   await expect(page.getByRole('option')).toHaveCount(2);
  97  |   await page.getByRole('option', { name: /供应商 B/ }).click();
  98  |   await expect(page.locator('#modelValue')).toHaveText('same');
  99  |   await expect.poll(async () => (await saved(page)).activeProviderId).toBe('b');
  100 |   await command(page, '/model');
  101 |   await expect(page.locator('.command-panel')).not.toContainText('hidden-model');
  102 |   await page.locator('#composerInput').press('Escape');
  103 |   await command(page, '/model model-b');
  104 |   await expect(page.locator('#modelValue')).toHaveText('model-b');
  105 |   await page.locator('#runtimeBtn').click();
  106 |   await page.locator('[data-runtime-open="model"]').click();
  107 |   await page.locator('[data-provider-id="a"][data-model="model-a"]').click();
  108 |   await expect(page.locator('#modelValue')).toHaveText('model-a');
  109 | });
  110 | 
  111 | test('部分模型名不会自动执行，无效参数保持输入', async ({ page }) => {
  112 |   await load(page); await command(page, '/model model-');
  113 |   await expect(page.getByRole('option')).toHaveCount(2);
  114 |   await expect(page.locator('#modelValue')).toHaveText('model-a');
  115 |   await page.locator('#composerInput').press('Escape');
  116 |   await command(page, '/effort wrong');
  117 |   await expect(page.locator('.command-feedback')).toContainText('无效强度');
  118 |   await expect(page.locator('#composerInput')).toHaveValue('/effort wrong');
  119 |   await command(page, '/help extra'); await expect(page.locator('.command-feedback')).toContainText('不接受参数');
  120 | });
  121 | 
  122 | test('压缩首次补全不执行，重复请求受阻，新草稿不会被清除', async ({ page }) => {
  123 |   let calls = 0; let release;
  124 |   const gate = new Promise(resolve => { release = resolve; });
  125 |   await page.route('**/api/chat/compress', async route => { calls++; await gate; await route.fulfill({ json: { summary: '压缩摘要' } }); });
  126 |   await load(page, { messages: history });
  127 |   const input = page.locator('#composerInput');
  128 |   await input.fill('/comp'); await input.press('Enter');
  129 |   await expect(input).toHaveValue('/compact'); expect(calls).toBe(0);
  130 |   await input.press('Enter'); await expect.poll(() => calls).toBe(1);
  131 |   await input.fill('/compact'); await page.locator('#sendBtn').click();
  132 |   await expect(page.locator('.command-feedback')).toContainText('等待完成');
  133 |   await input.fill('稍后发送的新草稿'); release();
  134 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('压缩摘要');
  135 |   await expect(input).toHaveValue('稍后发送的新草稿'); expect(calls).toBe(1);
  136 | });
  137 | 
  138 | test('空历史保留指令', async ({ page }) => {
  139 |   await load(page);
  140 |   await command(page, '/compact'); await expect(page.locator('.command-feedback')).toContainText('没有可压缩');
  141 |   await expect(page.locator('#composerInput')).toHaveValue('/compact');
  142 | });
  143 | 
  144 | test('字面量、多行和正文斜杠进入普通消息，指令不进入 Prompt 或标题', async ({ page }) => {
  145 |   const bodies = [];
  146 |   await page.route('**/api/chat', async r => { bodies.push(r.request().postDataJSON()); await r.fulfill({ json: { choices: [{ message: { content: '回答' } }] } }); });
  147 |   await load(page);
  148 |   await command(page, '/effort high');
  149 |   for (const [text, sent] of [['//model', '/model'], ['正文 /effort', '正文 /effort'], ['/model\n这是一段文本', '/model\n这是一段文本']]) {
  150 |     await page.locator('#composerInput').fill(text); await page.locator('#sendBtn').click();
  151 |     await expect.poll(() => bodies.length).toBe([ '//model', '正文 /effort', '/model\n这是一段文本' ].indexOf(text) + 1);
  152 |     await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  153 |     expect(bodies.at(-1).messages.filter(m => m.role === 'user').at(-1).content).toBe(sent);
  154 |   }
  155 |   expect(bodies[0].reasoningEffort).toBe('high');
  156 |   expect(bodies.flatMap(b => b.messages).some(m => m.content === '/effort high')).toBe(false);
  157 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').title).toBe('/model');
  158 | });
  159 | 
  160 | test('首次响应之后的生成期间配置修改只影响下一次请求，停止按钮保持原行为', async ({ page }) => {
  161 |   const bodies = []; let release;
  162 |   const gate = new Promise(resolve => { release = resolve; });
  163 |   await page.route('**/api/chat', async r => { bodies.push(r.request().postDataJSON()); if (bodies.length === 1) await gate; await r.fulfill({ json: { choices: [{ message: { content: '完成' } }] } }); });
  164 |   await load(page, { messages: history });
  165 |   const input = page.locator('#composerInput');
  166 |   await input.fill('已有历史后的第一轮'); await page.locator('#sendBtn').click(); await expect.poll(() => bodies.length).toBe(1);
  167 |   await input.fill('/model model-b'); await input.press('Enter');
  168 |   await expect(page.locator('#modelValue')).toHaveText('model-b');
  169 |   await input.fill('/effort high'); await input.press('Enter');
  170 |   await expect(page.locator('#effortValue')).toHaveText('高');
  171 |   await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '停止生成');
  172 |   expect(bodies[0].model).toBe('model-a'); expect(bodies[0].reasoningEffort).toBe('medium');
  173 |   release(); await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  174 |   await input.fill('第二轮'); await page.locator('#sendBtn').click(); await expect.poll(() => bodies.length).toBe(2);
  175 |   expect(bodies[1].model).toBe('model-b'); expect(bodies[1].reasoningEffort).toBe('high');
  176 | });
  177 | 
  178 | test('输入法确认不会执行指令，关闭和会话切换保留草稿', async ({ page }) => {
  179 |   await load(page);
  180 |   const input = page.locator('#composerInput');
  181 |   await input.fill('/effort high');
  182 |   await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  183 |   await expect(page.locator('#effortValue')).toHaveText('中等');
  184 |   await input.press('Escape'); await expect(input).toHaveValue('/effort high');
  185 |   await input.fill('/model '); await expect(page.locator('.command-panel')).toBeVisible();
  186 |   await page.locator('[data-conversation-id="other"]').click();
  187 |   await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(input).toHaveValue('另一份草稿');
  188 |   await page.locator('[data-conversation-id="c"]').click(); await expect(input).toHaveValue('/model ');
  189 | });
  190 | 
  191 | for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  192 |   test(`指令面板 ${scheme} ${width} 无溢出且 panel 悬停稳定`, async ({ page }, testInfo) => {
  193 |     await page.setViewportSize({ width, height: 840 }); await load(page, { scheme });
  194 |     await page.locator('#composerInput').fill('/');
  195 |     const panel = page.locator('.command-panel'); await expect(panel).toBeVisible();
> 196 |     await expect(page.locator('.command-option-title')).toHaveText(['模型', '思考强度', '压缩历史', '帮助']);
      |                                                         ^ Error: expect(locator).toHaveText(expected) failed
  197 |     await expect(page.locator('.command-option-icon svg')).toHaveCount(4);
  198 |     await expect(page.locator('#composerInput')).toBeFocused();
  199 |     expect(await page.locator('#composerInput').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
  200 |     expect(await page.locator('#composerInput').evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  201 |     const paint = el => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderColor]; };
  202 |     const before = await panel.evaluate(paint); await panel.hover(); expect(await panel.evaluate(paint)).toEqual(before);
  203 |     const rect = await panel.boundingBox(); const input = await page.locator('#composerInput').boundingBox();
  204 |     expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(width);
  205 |     expect(rect.y + rect.height).toBeLessThanOrEqual(input.y);
  206 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  207 |     await page.mouse.move(0, 0);
  208 |     await page.screenshot({ path: testInfo.outputPath(`commands-${scheme}-${width}.png`) });
  209 |     await panel.screenshot({ path: testInfo.outputPath(`menu-${scheme}-${width}.png`) });
  210 |   });
  211 | }
  212 | 
  213 | test('响应后压缩期间切换按钮模型，已发送请求和压缩仍使用原快照', async ({ page }) => {
  214 |   const messages = Array.from({ length: 4 }, (_, i) => [
  215 |     { id: `u${i}`, role: 'user', content: '历史内容'.repeat(100) },
  216 |     { id: `a${i}`, role: 'assistant', content: '历史回复'.repeat(100) }
  217 |   ]).flat();
  218 |   let compressed; let sent; let release;
  219 |   const gate = new Promise(resolve => { release = resolve; });
  220 |   await page.route('**/api/chat/compress', async r => { compressed = r.request().postDataJSON(); await gate; await r.fulfill({ json: { summary: '简短历史摘要' } }); });
  221 |   await page.route('**/api/chat', async r => { sent = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { content: '继续' } }] } }); });
  222 |   await load(page, { providers: [{ ...provider, contextWindow: 6000, maxTokens: 1000 }, second, disabled], messages, config: { compressionThreshold: 10 } });
  223 |   await page.locator('#composerInput').fill('接着讲'); await page.locator('#sendBtn').click();
  224 |   await expect.poll(() => Boolean(compressed)).toBe(true);
  225 |   await page.locator('#runtimeBtn').click(); await page.locator('[data-runtime-open="model"]').click();
  226 |   await page.locator('[data-provider-id="a"][data-model="model-b"]').click();
  227 |   await expect(page.locator('#modelValue')).toHaveText('model-b'); release();
  228 |   await expect.poll(() => Boolean(sent)).toBe(true);
  229 |   expect(compressed.model).toBe('model-a'); expect(sent.model).toBe('model-a');
  230 |   expect(sent.reasoningEffort).toBe('medium');
  231 |   await expect(page.locator('#modelValue')).toHaveText('model-b');
  232 | });
  233 | 
  234 | test('压缩失败保留指令和附件且不创建普通指令消息', async ({ page }) => {
  235 |   await page.route('**/api/chat/compress', r => r.fulfill({ status: 500, json: { error: '模拟服务失败' } }));
  236 |   await load(page, { messages: history });
  237 |   await page.locator('#attachmentInput').setInputFiles({ name: '保留.txt', mimeType: 'text/plain', buffer: Buffer.from('本地资料') });
  238 |   await command(page, '/compact');
  239 |   await expect(page.locator('.command-feedback')).toContainText('未完成');
  240 |   await expect(page.locator('#composerInput')).toHaveValue('/compact');
  241 |   await expect(page.locator('#composerChips')).toContainText('保留.txt');
  242 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').messages.filter(m => m.role === 'user').length).toBe(2);
  243 | });
  244 | 
  245 | test('异步压缩完成后不修改其他会话草稿', async ({ page }) => {
  246 |   let release; let calls = 0;
  247 |   const gate = new Promise(resolve => { release = resolve; });
  248 |   await page.route('**/api/chat/compress', async r => { calls++; await gate; await r.fulfill({ json: { summary: '摘要' } }); });
  249 |   await load(page, { messages: history }); await command(page, '/compact');
  250 |   await expect.poll(() => calls).toBe(1);
  251 |   await page.locator('[data-conversation-id="other"]').click(); release();
  252 |   await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'c').contextCompression?.summary).toBe('摘要');
  253 |   await expect(page.locator('#composerInput')).toHaveValue('另一份草稿');
  254 |   await expect(page.locator('.command-feedback')).toBeHidden();
  255 | });
  256 | 
  257 | test('参数 Tab 只补全，方向键 Enter 选择，点击外部保留输入', async ({ page }) => {
  258 |   await load(page); const input = page.locator('#composerInput');
  259 |   await input.fill('/effort hi'); await input.press('Tab');
  260 |   await expect(input).toHaveValue('/effort high'); await expect(page.locator('#effortValue')).toHaveText('中等');
  261 |   await input.press('Enter'); await expect(page.locator('#effortValue')).toHaveText('高');
  262 |   await input.fill('/effort '); await input.press('ArrowDown'); await input.press('Enter');
  263 |   await expect(page.locator('#effortValue')).toHaveText('极高');
  264 |   await input.fill('/model '); await page.locator('.stage-header').click();
  265 |   await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(input).toHaveValue('/model ');
  266 | });
  267 | 
  268 | for (const [kind, providers, offline, title] of [
  269 |   ['offline', [], true, '本地服务未连接'],
  270 |   ['unconfigured', [], false, '先连接一个模型'],
  271 |   ['ready', [provider], false, '今天想聊点什么？']
  272 | ]) {
  273 |   test(`空状态 ${kind} 准确引导`, async ({ page }) => {
  274 |     await load(page, { providers, offline });
  275 |     await expect(page.locator('.empty-title')).toHaveText(title);
  276 |     await expect(page.locator('.suggestion-card')).toHaveCount(kind === 'ready' ? 3 : 0);
  277 |     if (kind !== 'ready') await expect(page.locator('.empty-setup-link')).toHaveAttribute('href', '#/settings/providers');
  278 |   });
  279 | }
  280 | 
  281 | test('重名模型的显式选择列表可按 Enter 确认', async ({ page }) => {
  282 |   await load(page); const input = page.locator('#composerInput');
  283 |   await input.fill('/model same'); await input.press('Enter');
  284 |   await expect(page.locator('.command-panel-message')).toContainText('重复');
  285 |   await input.press('Enter'); await expect(page.locator('#modelValue')).toHaveText('same');
  286 |   await expect(input).toHaveValue('');
  287 | });
  288 | 
  289 | test('帮助支持键盘滚动并在 Escape 后恢复输入焦点', async ({ page }) => {
  290 |   await page.setViewportSize({ width: 390, height: 640 }); await load(page);
  291 |   await command(page, '/help'); await page.locator('#composerInput').press('PageDown');
  292 |   expect(await page.locator('.command-panel-host').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  293 |   await page.locator('#composerInput').press('Escape');
  294 |   await expect(page.locator('.command-panel-host')).toBeHidden(); await expect(page.locator('#composerInput')).toBeFocused();
  295 | });
  296 | 
```