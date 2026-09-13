# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> 压缩上下文：点击直接压缩，按会话锁定发送，进度提示可回看
- Location: e2e/app.spec.js:1301:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('.compress-notice')
Expected pattern: /正在压缩上下文/
Error: strict mode violation: locator('.compress-notice') resolved to 2 elements:
    1) <div tabindex="0" role="button" title="点击查看压缩状态" data-notice="context-compress" class="compress-notice is-running">…</div> aka getByRole('button', { name: '正在压缩上下文 压缩中' })
    2) <div hidden="" role="status" aria-live="polite" class="command-feedback compress-notice"></div> aka locator('.command-feedback')

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.compress-notice')

```

```
Error: "page.waitForTimeout: Test ended." while running route callback.
Consider awaiting `await page.unrouteAll({ behavior: 'ignoreErrors' })`
before the end of the test to ignore remaining routes in flight.
```

# Page snapshot

```yaml
- generic [ref=e2]:
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
          - button "压缩对话 今天" [ref=e54] [cursor=pointer]:
            - generic [ref=e55]: 压缩对话
            - generic [ref=e57]: 今天
      - navigation "应用导航" [ref=e59]:
        - button "设置" [ref=e60] [cursor=pointer]
    - main [ref=e65]:
      - generic [ref=e66]:
        - generic [ref=e68]:
          - generic [ref=e69]: Chat · 对话
          - generic [ref=e70]: 压缩对话
        - generic "本地服务正常" [ref=e73]
      - region "对话" [ref=e77]:
        - generic [ref=e79]:
          - generic [ref=e80]:
            - paragraph [ref=e83]: 你好
            - generic [ref=e84]: 12:51
            - generic [ref=e85]:
              - button "复制" [ref=e86] [cursor=pointer]
              - button "编辑" [ref=e90] [cursor=pointer]
              - button "复制到新对话" [ref=e94] [cursor=pointer]
              - button "删除消息" [ref=e100] [cursor=pointer]
          - generic [ref=e103]:
            - generic [ref=e104]:
              - generic [ref=e109]: 示例供应商
              - generic [ref=e110]: demo-model
            - paragraph [ref=e114]: 你好，很高兴见到你。
            - generic [ref=e115]: 12:52 · 1s
            - generic [ref=e116]:
              - button "复制" [ref=e117] [cursor=pointer]
              - button "编辑" [ref=e121] [cursor=pointer]
              - button "复制到新对话" [ref=e125] [cursor=pointer]
              - button "删除消息" [ref=e131] [cursor=pointer]
          - generic [ref=e134]:
            - paragraph [ref=e137]: 另一轮历史
            - generic [ref=e138]: 13:51
            - generic [ref=e139]:
              - button "复制" [ref=e140] [cursor=pointer]
              - button "编辑" [ref=e144] [cursor=pointer]
              - button "复制到新对话" [ref=e148] [cursor=pointer]
              - button "删除消息" [ref=e154] [cursor=pointer]
          - generic [ref=e157]:
            - generic [ref=e158]:
              - generic [ref=e163]: 示例供应商
              - generic [ref=e164]: demo-model
            - paragraph [ref=e168]: 最近回复
            - generic [ref=e169]: 13:51
            - generic [ref=e170]:
              - button "复制" [ref=e171] [cursor=pointer]
              - button "编辑" [ref=e175] [cursor=pointer]
              - button "复制到新对话" [ref=e179] [cursor=pointer]
              - button "删除消息" [ref=e185] [cursor=pointer]
          - button "正在压缩上下文 压缩中" [ref=e189] [cursor=pointer]:
            - generic [ref=e194]: 正在压缩上下文
            - generic [ref=e196]: 压缩中
        - generic [ref=e201]:
          - generic [ref=e202]:
            - textbox "输入消息，/ 打开指令" [ref=e204]
            - generic [ref=e205]:
              - button "添加附件" [ref=e206] [cursor=pointer]
              - generic [ref=e209]:
                - button "demo-model 中等" [ref=e210] [cursor=pointer]:
                  - generic [ref=e211]: demo-model
                  - generic [ref=e212]: 中等
                - button "正在压缩上下文" [active] [ref=e216] [cursor=pointer]
                - button "发送" [disabled] [ref=e221]
          - generic [ref=e224]: Enter 发送 · Shift + Enter 换行
  - generic:
    - tooltip "上下文用量 0% · 约 51 / 116.3k Tokens 点击压缩历史":
      - generic: 上下文用量
      - generic: 0% · 约 51 / 116.3k Tokens
      - generic: 点击压缩历史
```

# Test source

```ts
  1203 |   await seedAndLoad(page, { state });
  1204 |   await page.goto("/");
  1205 |   await page.fill("#composerInput", "写长文");
  1206 |   await page.click("#sendBtn");
  1207 |   // 正文开始后思维链自动收起 → 用户手动重新展开
  1208 |   const entry = page.locator(".message-entry.assistant").last();
  1209 |   await expect(entry.locator(".message-body .markdown-body")).toContainText("第 1 行", { timeout: 8000 });
  1210 |   await entry.locator(".reasoning-toggle").click();
  1211 |   await expect(entry.locator(".reasoning-sheet")).toHaveAttribute("data-open", "true");
  1212 |   // 上滑离开底部（阅读历史位置）：真实滚轮手势解除跟随（程序设置 scrollTop 不算用户意图）
  1213 |   await page.waitForFunction(() => {
  1214 |     const el = document.querySelector("#messageScroll");
  1215 |     return el && el.scrollHeight > el.clientHeight + 200;
  1216 |   });
  1217 |   const scrollBox = await page.locator("#messageScroll").boundingBox();
  1218 |   await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  1219 |   await page.mouse.wheel(0, -260);
  1220 |   // 脱离跟随后「有新回复」按钮出现
  1221 |   await expect(page.locator("#newRepliesBtn")).toBeVisible({ timeout: 3000 });
  1222 |   // 切到会话 B 再切回 A
  1223 |   await page.locator('[data-conversation-id="conv-b"]').click();
  1224 |   await expect(page.locator("#stageTitle")).toContainText("会话 B");
  1225 |   await page.locator('[data-conversation-id="conv-a"]').click();
  1226 |   // 思维链仍为展开、阅读位置未被强制回底
  1227 |   await expect(entry.locator(".reasoning-sheet")).toHaveAttribute("data-open", "true");
  1228 |   const awayFromBottom = await page.locator("#messageScroll").evaluate((el) =>
  1229 |     el.scrollHeight - el.scrollTop - el.clientHeight > 100
  1230 |   );
  1231 |   expect(awayFromBottom).toBe(true);
  1232 | });
  1233 | 
  1234 | test("额度提示原位更新（tooltip 活更新，不重建）", async ({ page }) => {
  1235 |   await page.route("**/api/chat", async (route) => {
  1236 |     await page.waitForTimeout(500);
  1237 |     await route.fulfill({
  1238 |       status: 200,
  1239 |       headers: { "content-type": "text/event-stream; charset=utf-8" },
  1240 |       body: [
  1241 |         'event: chat.stream.started\ndata: {"version":1,"providerId":"p-demo","reasoningKind":"thinking"}\n\n',
  1242 |         'event: chat.content.delta\ndata: {"delta":"延迟回复，用于验证额度提示原位更新。"}\n\n',
  1243 |         'event: chat.usage\ndata: {"inputTokens":24,"outputTokens":12,"totalTokens":36,"estimated":false}\n\n',
  1244 |         'event: chat.stream.completed\ndata: {"finishReason":"stop"}\n\n'
  1245 |       ].join("")
  1246 |     });
  1247 |   });
  1248 |   await seedAndLoad(page);
  1249 |   await page.goto("/");
  1250 |   await page.fill("#composerInput", "占位");
  1251 |   await page.click("#sendBtn");
  1252 |   // hover 触发 tooltip（聚焦亦可），校验活更新
  1253 |   await page.focus("#usageBtn");
  1254 |   const tooltip = page.locator("#contextTooltip");
  1255 |   await expect(tooltip).toHaveClass(/is-open/);
  1256 |   const before = await tooltip.locator("[data-tooltip-usage]").textContent();
  1257 |   await expect.poll(() => tooltip.locator("[data-tooltip-usage]").textContent(), { timeout: 8000 }).not.toBe(before);
  1258 |   await expect(tooltip).toHaveClass(/is-open/);
  1259 | });
  1260 | 
  1261 | test("额度提示：真实 token 与消息脚注一致，悬停只显示精简信息", async ({ page }) => {
  1262 |   const conversation = seededConversation("conv-a", "对话甲");
  1263 |   conversation.messages[1].usage = { inputTokens: 603, outputTokens: 3104, totalTokens: 3707, estimated: false };
  1264 |   const state = {
  1265 |     ...SEED_STATE,
  1266 |     conversations: [conversation],
  1267 |     activeConversationId: "conv-a"
  1268 |   };
  1269 |   await seedAndLoad(page, { state });
  1270 |   await page.goto("/");
  1271 |   await page.locator("#usageBtn").hover();
  1272 |   const tooltip = page.locator("#contextTooltip");
  1273 |   await expect(tooltip).toHaveClass(/is-open/);
  1274 |   await expect(tooltip.locator("[data-tooltip-title]")).toHaveText("上下文用量");
  1275 |   await expect(tooltip.locator("[data-tooltip-usage]")).toContainText("3707");
  1276 |   await expect(page.locator('.message-entry.assistant .message-meta')).toContainText("3707 tokens");
  1277 |   await expect(tooltip.locator(".context-tooltip-line").filter({ hasText: "历史与摘要" })).toHaveCount(0);
  1278 |   await expect(tooltip.locator("[data-tooltip-hint]")).toHaveText("点击压缩历史");
  1279 |   const info = await tooltip.locator("[data-tooltip-usage]").evaluate((el) => ({
  1280 |     whiteSpace: getComputedStyle(el).whiteSpace,
  1281 |     height: Math.round(el.getBoundingClientRect().height)
  1282 |   }));
  1283 |   expect(info.whiteSpace).toBe("nowrap");
  1284 |   expect(info.height).toBeLessThan(24);
  1285 | 
  1286 |   for (const scheme of ["light", "dark"]) for (const width of [1280, 1024, 390]) {
  1287 |     await page.setViewportSize({ width, height: 800 });
  1288 |     await page.evaluate((appearanceMode) => localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ themeId: "everforest", appearanceMode })), scheme);
  1289 |     await page.reload();
  1290 |     await page.locator("#usageBtn").hover();
  1291 |     const layout = await page.locator("#contextTooltip").evaluate((element) => {
  1292 |       const rect = element.getBoundingClientRect();
  1293 |       return { pageFits: document.documentElement.scrollWidth <= innerWidth, left: rect.left, right: rect.right, viewport: innerWidth };
  1294 |     });
  1295 |     expect(layout.pageFits).toBe(true);
  1296 |     expect(layout.left).toBeGreaterThanOrEqual(0);
  1297 |     expect(layout.right).toBeLessThanOrEqual(layout.viewport);
  1298 |   }
  1299 | });
  1300 | 
  1301 | test("压缩上下文：点击直接压缩，按会话锁定发送，进度提示可回看", async ({ page }) => {
  1302 |   await page.route("**/api/chat/compress", async (route) => {
> 1303 |     await page.waitForTimeout(900);
       |                ^ Error: "page.waitForTimeout: Test ended." while running route callback.
  1304 |     await route.fulfill({
  1305 |       status: 200,
  1306 |       headers: { "content-type": "application/json" },
  1307 |       body: JSON.stringify({ summary: "这是压缩后的隐藏摘要。" })
  1308 |     });
  1309 |   });
  1310 |   const state = {
  1311 |     ...SEED_STATE,
  1312 |     settingsSchemaVersion: 1,
  1313 |     chatConfig: {},
  1314 |     conversations: [{ ...seededConversation("conv-c", "压缩对话"), messages: [...seededConversation("conv-c", "压缩对话").messages, { id: "recent-user", role: "user", content: "另一轮历史" }, { id: "recent-assistant", role: "assistant", content: "最近回复" }] }],
  1315 |     activeConversationId: "conv-c"
  1316 |   };
  1317 |   await seedAndLoad(page, { state });
  1318 |   await page.goto("/");
  1319 |   // 点击圆环直接压缩：无二级弹层与确认弹窗，按钮进入忙态
  1320 |   await page.click("#usageBtn");
  1321 |   await expect(page.locator("#usageBtn")).toHaveAttribute("aria-busy", "true");
  1322 |   // 压缩提示 = 假模型响应出现在对话中，本对话发送被锁定
  1323 |   await expect(page.locator(".compress-notice")).toHaveText(/正在压缩上下文/);
  1324 |   await page.fill("#composerInput", "压缩期间尝试发送");
  1325 |   await expect(page.locator("#sendBtn")).toBeDisabled();
  1326 |   // 完成后：提示更新为完毕态，发送恢复，忙态解除
  1327 |   await expect(page.locator(".compress-notice")).toHaveText(/上下文已压缩/, { timeout: 8000 });
  1328 |   await expect(page.locator("#sendBtn")).toBeEnabled();
  1329 |   await expect(page.locator("#usageBtn")).toHaveAttribute("aria-busy", "false");
  1330 |   // 通知系统关闭后，点击提示卡不会再生成全局 Toast。
  1331 |   await page.click(".compress-notice");
  1332 |   await expect(page.locator(".toast-note")).toHaveCount(0);
  1333 | });
  1334 | 
  1335 | test("主题明暗切换自动换色", async ({ page }) => {
  1336 |   await seedAndLoad(page, { hash: "#/settings/appearance" });
  1337 |   await page.goto("/");
  1338 |   const pear = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pear").trim());
  1339 |   expect(pear).toBe("#FF3B1F");
  1340 |   const light = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  1341 |   expect(light).toBe("#FF3B1F");
  1342 |   // 默认主题为双态，明暗由 appearanceMode 切换。
  1343 |   await page.locator(".appearance-mode-option").filter({ hasText: "深色" }).click();
  1344 |   await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  1345 |   const dark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  1346 |   expect(dark).toBe("#FF8A3D");
  1347 |   const pearDark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pear").trim());
  1348 |   expect(pearDark).toBe("#FF8A3D");
  1349 |   // 代码框令牌也随明暗切换（独立暖调家族色）
  1350 |   const codeBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--code-bg").trim());
  1351 |   expect(codeBg).toBe("#211510");
  1352 | });
  1353 | 
  1354 | test("设置：外观主题卡与自定义导入入口", async ({ page }) => {
  1355 |   await seedAndLoad(page, { hash: "#/settings/appearance" });
  1356 |   await page.goto("/");
  1357 |   await expect(page.locator(".settings-pane-title")).toContainText("外观");
  1358 |   // 首启种子只包含 Tako Festival · 章鱼烧祭。
  1359 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  1360 |   await expect(page.locator(".theme-card").nth(0)).toHaveAttribute("data-theme-id", "everforest");
  1361 |   // 稳定语义内容与选中状态（不依赖已删除的装饰性内部标签）
  1362 |   const everforestCard = page.locator('[data-theme-id="everforest"]');
  1363 |   await expect(everforestCard).toHaveAttribute("aria-pressed", "true");
  1364 |   await expect(everforestCard).toHaveClass(/is-active/);
  1365 |   await expect(everforestCard.locator(".theme-strip-name")).toHaveText("Tako Festival · 章鱼烧祭");
  1366 |   await expect(everforestCard.locator(".theme-strip-status")).toContainText("当前主题");
  1367 |   await expect(everforestCard).toHaveAttribute("aria-label", "Tako Festival · 章鱼烧祭，当前主题");
  1368 |   await expect(page.locator("#themePackageImportBtn")).toHaveText(/导入主题/);
  1369 |   await expect(page.locator("#themePackageExportBtn")).toHaveText(/导出/);
  1370 |   // 明暗模式切换不改变当前主题 ID。
  1371 |   await page.locator(".appearance-mode-option").filter({ hasText: "深色" }).click();
  1372 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1373 |   await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  1374 | 
  1375 |   // 唯一默认主题保持自己的深色令牌，背景不再创建主题动效层。
  1376 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1377 |   await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  1378 |   await expect(page.locator(".motion-layer")).toHaveCount(0);
  1379 |   const everforestCanvas = await page.evaluate(() =>
  1380 |     getComputedStyle(document.documentElement).getPropertyValue("--canvas-mid").trim());
  1381 |   expect(everforestCanvas).toBe("#1A1210");
  1382 |   await page.reload();
  1383 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1384 | });
  1385 | 
  1386 | test("主题背景动效已停用", async ({ page }) => {
  1387 |   await seedAndLoad(page, { themeId: "everforest" });
  1388 |   await page.setViewportSize({ width: 1280, height: 720 });
  1389 |   await page.emulateMedia({ reducedMotion: "no-preference" });
  1390 |   await page.goto("/");
  1391 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1392 |   await expect(page.locator(".motion-layer")).toHaveCount(0);
  1393 |   await expect(page.locator(".ambient-grain, .ambient-light")).toHaveCount(0);
  1394 |   await expect(page.locator(".app-canvas")).toHaveCSS("background-image", "none");
  1395 | });
  1396 | 
  1397 | test("Tako Festival · 章鱼烧祭 在减少动态模式下完全不创建动效层", async ({ page }) => {
  1398 |   await seedAndLoad(page, { themeId: "everforest" });
  1399 |   await page.emulateMedia({ reducedMotion: "reduce" });
  1400 |   await page.goto("/");
  1401 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1402 |   await expect(page.locator(".motion-layer")).toHaveCount(0);
  1403 | });
```