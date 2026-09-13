# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> 主题 JSON：更新默认主题、重启恢复并删除自定义变体
- Location: e2e/app.spec.js:1457:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#themePackageImportBtn')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#themePackageImportBtn')

```

```yaml
- main:
  - button "返回对话"
  - text: Settings · 设置 设置 本地服务正常
  - region "设置":
    - complementary "设置目录":
      - heading "偏好设置" [level=2]
      - searchbox "搜索设置"
      - navigation "设置分类":
        - button "外观":
          - strong: 外观
        - button "模型与供应商":
          - strong: 模型与供应商
        - button "上下文与提示词":
          - strong: 上下文与提示词
        - button "工具":
          - strong: 工具
        - button "技能":
          - strong: 技能
        - button "数据管理":
          - strong: 数据管理
        - button "关于与更新":
          - strong: 关于与更新
    - heading "外观" [level=2]
    - region "常用配置":
      - heading "常用配置" [level=3]
      - region "明暗模式":
        - heading "明暗模式" [level=3]
        - paragraph: 当前为浅色
        - radio "跟随系统" [checked]
        - text: 跟随系统
        - radio "浅色"
        - text: 浅色
        - radio "深色"
        - text: 深色
      - region "界面层次":
        - heading "界面层次" [level=3]
        - paragraph: 浅色 · 即时生效
        - text: 对比度
        - status: "60"
        - paragraph: 背景与卡片的明暗差异。
        - slider "对比度": "60"
        - text: 柔和 鲜明 透景模式 卡片与弹窗使用毛玻璃。
        - switch "开启透景模式"
```

# Test source

```ts
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
  1411 |   await expect(page.locator(".empty-card")).toBeVisible();
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
> 1460 |   await expect(page.locator("#themePackageImportBtn")).toBeVisible();
       |                                                        ^ Error: expect(locator).toBeVisible() failed
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
  1512 |     page.waitForEvent("filechooser"),
  1513 |     page.locator("#themePackageImportBtn").click()
  1514 |   ]);
  1515 |   await variantChooser.setFiles(variantPath);
  1516 |   await expect(page.locator(".theme-card")).toHaveCount(2);
  1517 | 
  1518 |   // 删除变体主题：回落到 Tako Festival · 章鱼烧祭 默认主题。
  1519 |   await page.locator('[data-theme-remove="everforest-variant"]').click();
  1520 |   await expect(page.locator(".dialog-backdrop")).toBeVisible();
  1521 |   await page.locator(".dialog-backdrop [data-role='confirm']").click();
  1522 |   await expect(page.locator(".theme-card")).toHaveCount(1);
  1523 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1524 | });
  1525 | 
  1526 | test("主题界面字体：导入 typefaces 主题后字体令牌生效，删除后恢复默认", async ({ page }) => {
  1527 |   await seedAndLoad(page, { hash: "#/settings/appearance" });
  1528 |   await page.goto("/");
  1529 |   const fontThemePath = path.join(os.tmpdir(), `ChenTako-font-theme-${Date.now()}.json`);
  1530 |   const fontTheme = {
  1531 |     format: "clawbox-theme",
  1532 |     version: 2,
  1533 |     id: "fonttrial",
  1534 |     name: "圆体测试",
  1535 |     typefaces: { body: "rounded", display: "songti", mono: "mono" },
  1536 |     colors: {
  1537 |       light: { canvas: { middle: "#f4f8f9" } },
  1538 |       dark: { canvas: { middle: "#0f1b26" } }
  1539 |     }
  1540 |   };
  1541 |   writeFileSync(fontThemePath, JSON.stringify(fontTheme));
  1542 |   const [fileChooser] = await Promise.all([
  1543 |     page.waitForEvent("filechooser"),
  1544 |     page.locator("#themePackageImportBtn").click()
  1545 |   ]);
  1546 |   await fileChooser.setFiles(fontThemePath);
  1547 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "fonttrial");
  1548 |   const fontTokens = await page.evaluate(() => ({
  1549 |     body: getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim(),
  1550 |     display: getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim(),
  1551 |     mono: getComputedStyle(document.documentElement).getPropertyValue("--font-code").trim()
  1552 |   }));
  1553 |   expect(fontTokens.body).toContain("Yuanti SC");
  1554 |   expect(fontTokens.display).toContain("Songti SC");
  1555 |   expect(fontTokens.mono).toContain("SF Mono");
  1556 |   // 删除主题回落 Tako Festival · 章鱼烧祭，字体回到主题的人文无衬线体系。
  1557 |   await page.locator('[data-theme-remove="fonttrial"]').click();
  1558 |   await page.locator(".dialog-backdrop [data-role='confirm']").click();
  1559 |   await expect(page.locator("html")).toHaveAttribute("data-theme", "everforest");
  1560 |   const restored = await page.evaluate(() =>
```