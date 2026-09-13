# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commands.spec.js >> 空状态 offline 准确引导
- Location: e2e/commands.spec.js:273:3

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.empty-title')
Expected: "本地服务未连接"
Received: "欢迎回来，随时开始吧"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.empty-title')
    14 × locator resolved to <h2 class="empty-title">欢迎回来，随时开始吧</h2>
       - unexpected value "欢迎回来，随时开始吧"

```

```yaml
- heading "欢迎回来，随时开始吧" [level=2]
```

# Test source

```ts
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
  196 |     await expect(page.locator('.command-option-title')).toHaveText(['模型', '思考强度', '压缩历史', '帮助']);
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
> 275 |     await expect(page.locator('.empty-title')).toHaveText(title);
      |                                                ^ Error: expect(locator).toHaveText(expected) failed
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
  297 | test('输入指令时点击停止按钮只停止回复，不执行指令', async ({ page }) => {
  298 |   let release; let calls = 0;
  299 |   const gate = new Promise(resolve => { release = resolve; });
  300 |   await page.route('**/api/chat', async r => { calls++; await gate; await r.fulfill({ json: { choices: [{ message: { content: '结果' } }] } }); });
  301 |   await load(page); const input = page.locator('#composerInput');
  302 |   await input.fill('开始'); await page.locator('#sendBtn').click(); await expect.poll(() => calls).toBe(1);
  303 |   await input.fill('/effort high'); await page.locator('#sendBtn').click();
  304 |   await expect(page.locator('#sendBtn')).toHaveAttribute('aria-label', '发送');
  305 |   await expect(input).toHaveValue('/effort high'); await expect(page.locator('#effortValue')).toHaveText('中等'); release();
  306 | });
  307 | 
  308 | for (const scheme of ['light', 'dark']) {
  309 |   test(`默认 ${scheme} 辅助文字与选择项对比度至少 4.5`, async ({ page }) => {
  310 |     await load(page, { scheme }); await page.locator('#composerInput').fill('/');
  311 |     const ratios = await page.locator('.command-option-detail, .command-panel-hint, .composer-hint, .empty-lede').evaluateAll(elements => {
  312 |       const rgb = text => {
  313 |         const values = (text.match(/[\d.]+/g) || []).map(Number);
  314 |         return text.startsWith('color(srgb ') ? values.map((value, index) => index < 3 ? value * 255 : value) : values;
  315 |       };
  316 |       const blend = (front, back) => { const a = front[3] ?? 1; return front.slice(0, 3).map((v, i) => v * a + back[i] * (1 - a)); };
  317 |       const luminance = color => color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  318 |       return elements.map(el => {
  319 |         const ancestors = []; let node = el;
  320 |         while (node) { ancestors.unshift(node); node = node.parentElement; }
  321 |         let background = [255, 255, 255];
  322 |         for (const ancestor of ancestors) background = blend(rgb(getComputedStyle(ancestor).backgroundColor), background);
  323 |         const style = getComputedStyle(el); const foreground = blend(rgb(style.color), background);
  324 |         const a = luminance(foreground), b = luminance(background);
  325 |         return { element: el.className, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), size: parseFloat(style.fontSize) };
  326 |       });
  327 |     });
  328 |     console.log(JSON.stringify({ scheme, minimumContrast: Math.min(...ratios.map(sample => sample.ratio)), samples: ratios }));
  329 |     for (const sample of ratios) { expect(sample.ratio).toBeGreaterThanOrEqual(4.5); expect(sample.size).toBeGreaterThanOrEqual(12); }
  330 |   });
  331 | }
  332 | 
  333 | 
  334 | test('录屏对齐：鼠标和键盘共用唯一活动行，二级当前值用勾选表达', async ({ page }, testInfo) => {
  335 |   await load(page);
  336 |   const input = page.locator('#composerInput');
  337 |   await input.fill('/');
  338 |   const options = page.getByRole('option');
  339 |   await expect(page.locator('.command-panel-hint')).toHaveCount(0);
  340 |   await expect(page.locator('.command-panel-heading')).toHaveCount(0);
  341 |   expect((await options.first().boundingBox()).height).toBeLessThanOrEqual(34);
  342 |   await options.nth(1).hover();
  343 |   await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  344 |   await expect(page.locator('.command-option.is-active')).toHaveCount(1);
  345 |   await input.press('ArrowDown');
  346 |   await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
  347 |   // The stationary pointer must not leave a second CSS-only highlight behind.
  348 |   const backgrounds = await options.evaluateAll(rows => rows.map(row => getComputedStyle(row).backgroundColor));
  349 |   expect(backgrounds.filter(color => color !== 'rgba(0, 0, 0, 0)')).toHaveLength(1);
  350 |   await options.nth(1).hover();
  351 |   await options.nth(1).click();
  352 |   await expect(page.locator('.command-option-check')).toHaveCount(1);
  353 |   await expect(page.locator('.command-panel-heading')).toHaveCount(0);
  354 |   await expect(input).toBeFocused();
  355 |   await page.mouse.move(0, 0);
  356 |   await page.screenshot({ path: testInfo.outputPath('command-effort-submenu.png') });
  357 |   await page.locator('.command-panel').screenshot({ path: testInfo.outputPath('effort-menu.png') });
  358 |   await page.getByRole('option', { name: /高 high/ }).click();
  359 |   await expect(page.locator('#effortValue')).toHaveText('高');
  360 |   await expect(page.locator('.command-panel-host')).toBeHidden();
  361 |   await expect(input).toHaveValue('');
  362 |   await expect(input).toBeFocused();
  363 | });
  364 | 
  365 | for (const scheme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
  366 |   test(`欢迎页指令菜单不透字 ${scheme} ${width}`, async ({ page }, testInfo) => {
  367 |     await page.setViewportSize({ width, height: 900 });
  368 |     await load(page, { scheme });
  369 |     // 在透景开启时复现：菜单必须仍有独立的实色底板。
  370 |     await page.goto('/#/settings/appearance');
  371 |     await page.locator('#appearanceTransparentToggle').click();
  372 |     await expect(page.locator('html')).toHaveClass(/transparency-mode/);
  373 |     await page.goto('/#/chat');
  374 |     const input = page.locator('#composerInput');
  375 |     await input.fill('/');
```