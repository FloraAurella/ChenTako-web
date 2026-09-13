# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> Tako Festival · 章鱼烧祭 窄屏安全回退：无横向溢出或素材遮挡
- Location: e2e/app.spec.js:1405:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.empty-card')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.empty-card')

```

```yaml
- main:
  - button "展开侧栏"
  - text: Chat · 对话 新对话 本地服务正常
  - region "对话":
    - heading "欢迎回来，随时开始吧" [level=2]
    - button "当前项目：无项目": 无项目
    - textbox "输入消息，/ 打开指令"
    - button "添加附件"
    - button "demo-model 中等"
    - button "压缩上下文（已用约 0%）"
    - button "发送" [disabled]
    - text: Enter 发送 · Shift + Enter 换行
- navigation "主导航":
  - button "对话"
  - button "设置"
```

# Test source

```ts
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
  1404 | 
  1405 | test("Tako Festival · 章鱼烧祭 窄屏安全回退：无横向溢出或素材遮挡", async ({ page }) => {
  1406 |   await seedAndLoad(page, { themeId: "everforest" });
  1407 |   await page.setViewportSize({ width: 390, height: 844 });
  1408 |   await page.emulateMedia({ reducedMotion: "reduce" });
  1409 |   await page.goto("/");
  1410 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
> 1411 |   await expect(page.locator(".empty-card")).toBeVisible();
       |                                             ^ Error: expect(locator).toBeVisible() failed
  1412 |   await expect(page.locator(".composer-paper")).toBeVisible();
  1413 |   const layout = await page.evaluate(() => {
  1414 |     const card = document.querySelector(".empty-card").getBoundingClientRect();
  1415 |     const composer = document.querySelector(".composer-paper").getBoundingClientRect();
  1416 |     return {
  1417 |       documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  1418 |       viewportWidth: document.documentElement.clientWidth,
  1419 |       card: { left: card.left, right: card.right, bottom: card.bottom },
  1420 |       composerTop: composer.top
  1421 |     };
  1422 |   });
  1423 |   expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  1424 |   expect(layout.card.left).toBeGreaterThanOrEqual(0);
  1425 |   expect(layout.card.right).toBeLessThanOrEqual(layout.viewportWidth);
  1426 |   expect(layout.card.bottom).toBeLessThanOrEqual(layout.composerTop);
  1427 | });
  1428 | 
  1429 | test("JSON 主题文件：导出当前主题并重新导入应用", async ({ page }) => {
  1430 |   await seedAndLoad(page, { hash: "#/settings/appearance" });
  1431 |   await page.goto("/");
  1432 |   await page.locator('[data-theme-id="everforest"]').click();
  1433 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1434 |   await expect(page.locator(".motion-layer")).toHaveCount(0);
  1435 |   const [download] = await Promise.all([
  1436 |     page.waitForEvent("download"),
  1437 |     page.locator("#themePackageExportBtn").click()
  1438 |   ]);
  1439 |   expect(download.suggestedFilename()).toMatch(/\.json$/);
  1440 |   const packagePath = await download.path();
  1441 |   expect(packagePath).toBeTruthy();
  1442 | 
  1443 |   // 实际往返默认源码主题：同 ID 更新，不改变顺序。
  1444 |   const [fileChooser] = await Promise.all([
  1445 |     page.waitForEvent("filechooser"),
  1446 |     page.locator("#themePackageImportBtn").click()
  1447 |   ]);
  1448 |   await fileChooser.setFiles(packagePath);
  1449 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1450 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  1451 |   await expect(page.locator(".theme-card").nth(0)).toHaveAttribute("data-theme-id", "everforest");
  1452 |   await expect(page.locator(".motion-layer")).toHaveCount(0);
  1453 |   // 同 ID 主题重新导入 = 更新（替换既有主题），且不会生成全局通知。
  1454 |   await expect(page.locator(".toast-note")).toHaveCount(0);
  1455 | });
  1456 | 
  1457 | test("主题 JSON：更新默认主题、重启恢复并删除自定义变体", async ({ page }) => {
  1458 |   await seedAndLoad(page, { hash: "#/settings/appearance" });
  1459 |   await page.goto("/");
  1460 |   await expect(page.locator("#themePackageImportBtn")).toBeVisible();
  1461 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  1462 | 
  1463 |   const examplePath = path.resolve(__dirname, "../src/resources/themes/tako-festival-theme-v1.json");
  1464 |   const [fileChooser] = await Promise.all([
  1465 |     page.waitForEvent("filechooser"),
  1466 |     page.locator("#themePackageImportBtn").click()
  1467 |   ]);
  1468 |   await fileChooser.setFiles(examplePath);
  1469 | 
  1470 |   // Tako Festival · 章鱼烧祭 已是种子主题：同 ID 重新导入 = 更新（替换），卡数不变。
  1471 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  1472 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1473 |   const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  1474 |   expect(accent).toBe("#FF3B1F");
  1475 |   const separator = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--separator").trim());
  1476 |   expect(separator).toBe("rgba(122,30,14,0.26)");
  1477 |   const effectTokens = await page.evaluate(() => ({
  1478 |     overlay: getComputedStyle(document.documentElement).getPropertyValue("--overlay-scrim").trim(),
  1479 |     group: getComputedStyle(document.documentElement).getPropertyValue("--group-color-5").trim()
  1480 |   }));
  1481 |   expect(effectTokens.overlay).toBe("rgba(40,20,27,0.45)");
  1482 |   expect(effectTokens.group).toBe("#7A1E0E");
  1483 | 
  1484 |   // buttons 模块：三类按钮令牌生效，主题包主操作底色跟随主题
  1485 |   const buttonTokens = await page.evaluate(() => ({
  1486 |     send: getComputedStyle(document.documentElement).getPropertyValue("--send-btn").trim(),
  1487 |     primary: getComputedStyle(document.documentElement).getPropertyValue("--btn-primary").trim(),
  1488 |     logo: getComputedStyle(document.documentElement).getPropertyValue("--brand-logo").trim(),
  1489 |     icon: getComputedStyle(document.documentElement).getPropertyValue("--icon-btn-ink").trim()
  1490 |   }));
  1491 |   // 主题包 JSON 明确为按钮定义朱橙色（#FF3B1F）配深棕文字保证对比度；
  1492 |   // 主色 #FF3B1F 同时用于品牌标识与强调色。次要按钮背景跟随 surface-elevated。
  1493 |   expect(buttonTokens.send).toBe("#FF3B1F");
  1494 |   expect(buttonTokens.primary).toBe("#FF3B1F");
  1495 |   expect(buttonTokens.logo).toBe("#FF3B1F");
  1496 |   expect(buttonTokens.icon).toBe("#7A1E0E");
  1497 |   await page.mouse.move(0, 0);
  1498 |   await expect(page.locator("#themePackageImportBtn")).toHaveCSS("background-color", "rgb(255, 228, 187)");
  1499 | 
  1500 |   // 重启后从本机存储恢复
  1501 |   await page.reload();
  1502 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1503 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  1504 | 
  1505 |   // 不同 ID 的主题文件会新建主题（同一 ID 才是更新）
  1506 |   const variantPath = path.join(os.tmpdir(), `everforest-variant-${Date.now()}.json`);
  1507 |   const variant = JSON.parse(readFileSync(examplePath, "utf8"));
  1508 |   variant.theme.id = "everforest-variant";
  1509 |   variant.theme.label = "Tako Festival · 章鱼烧祭 · 变体";
  1510 |   writeFileSync(variantPath, JSON.stringify(variant));
  1511 |   const [variantChooser] = await Promise.all([
```