# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> 主题界面字体：导入 typefaces 主题后字体令牌生效，删除后恢复默认
- Location: e2e/app.spec.js:1526:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "filechooser"
============================================================
```

# Page snapshot

```yaml
- main [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - button "返回对话" [ref=e8] [cursor=pointer]
      - generic [ref=e11]:
        - generic [ref=e12]: Settings · 设置
        - generic [ref=e13]: 设置
    - generic "本地服务正常" [ref=e16]
  - region "设置" [ref=e20]:
    - generic [ref=e21]:
      - complementary "设置目录" [ref=e22]:
        - heading "偏好设置" [level=2] [ref=e23]
        - searchbox "搜索设置" [ref=e29]
        - navigation "设置分类" [ref=e30]:
          - button [ref=e31] [cursor=pointer]:
            - strong [ref=e39]: 外观
          - button [ref=e40] [cursor=pointer]:
            - strong [ref=e46]: 模型与供应商
          - button [ref=e47] [cursor=pointer]:
            - strong [ref=e52]: 上下文与提示词
          - button [ref=e53] [cursor=pointer]:
            - strong [ref=e58]: 工具
          - button [ref=e59] [cursor=pointer]:
            - strong [ref=e65]: 技能
          - button [ref=e66] [cursor=pointer]:
            - strong [ref=e72]: 数据管理
          - button [ref=e73] [cursor=pointer]:
            - strong [ref=e79]: 关于与更新
      - generic [ref=e81]:
        - heading "外观" [level=2] [ref=e82]
        - region [ref=e83]:
          - heading "常用配置" [level=3] [ref=e85]
          - region [ref=e86]:
            - generic [ref=e87]:
              - heading "明暗模式" [level=3] [ref=e88]
              - paragraph [ref=e89]: 当前为浅色
            - generic [ref=e90]:
              - generic [ref=e91] [cursor=pointer]:
                - radio "跟随系统" [checked]
                - generic [ref=e92]: 跟随系统
              - generic [ref=e97] [cursor=pointer]:
                - radio "浅色"
                - generic [ref=e98]: 浅色
              - generic [ref=e103] [cursor=pointer]:
                - radio "深色"
                - generic [ref=e104]: 深色
          - region [ref=e108]:
            - generic [ref=e109]:
              - heading "界面层次" [level=3] [ref=e110]
              - paragraph [ref=e111]: 浅色 · 即时生效
            - generic [ref=e112]:
              - generic [ref=e113]:
                - generic [ref=e114]:
                  - generic [ref=e115]: 对比度
                  - status [ref=e116]: "60"
                - paragraph [ref=e117]: 背景与卡片的明暗差异。
                - slider "对比度" [ref=e118] [cursor=pointer]: "60"
                - generic [ref=e119]:
                  - generic [ref=e120]: 柔和
                  - generic [ref=e121]: 鲜明
              - generic [ref=e123]:
                - generic [ref=e124]:
                  - generic [ref=e125]: 透景模式
                  - generic [ref=e126]: 卡片与弹窗使用毛玻璃。
                - switch "开启透景模式" [ref=e127] [cursor=pointer]
```

# Test source

```ts
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
> 1543 |     page.waitForEvent("filechooser"),
       |          ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
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
  1561 |     getComputedStyle(document.documentElement).getPropertyValue("--font-body").trim());
  1562 |   expect(restored).toContain("Avenir Next");
  1563 | });
  1564 | 
  1565 | test("外观：纯色背景、对比度与透景模式", async ({ page }) => {
  1566 |   await seedAndLoad(page, { hash: "#/settings/appearance" });
  1567 |   await page.goto("/");
  1568 | 
  1569 |   await expect(page.locator("#bgUploadBtn")).toHaveCount(0);
  1570 |   await expect(page.locator(".user-bg-layer")).toHaveCount(0);
  1571 |   await expect(page.locator(".motion-layer")).toHaveCount(0);
  1572 |   await expect(page.locator("#appearanceContrastRange")).toHaveValue("60");
  1573 |   await expect(page.locator("#appearanceTransparentToggle")).toHaveAttribute("aria-checked", "false");
  1574 |   await expect(page.locator(".app-canvas")).toHaveCSS("background-image", "none");
  1575 | 
  1576 |   const before = await page.evaluate(() =>
  1577 |     document.documentElement.style.getPropertyValue("--appearance-panel-bg"));
  1578 |   await page.locator("#appearanceContrastRange").evaluate((element) => {
  1579 |     element.value = "30";
  1580 |     element.dispatchEvent(new Event("input", { bubbles: true }));
  1581 |   });
  1582 |   await expect(page.locator("#appearanceContrastValue")).toHaveText("30");
  1583 |   const after = await page.evaluate(() =>
  1584 |     document.documentElement.style.getPropertyValue("--appearance-panel-bg"));
  1585 |   expect(after).not.toBe(before);
  1586 | 
  1587 |   await page.locator("#appearanceTransparentToggle").click();
  1588 |   await expect(page.locator("html")).toHaveClass(/transparency-mode/);
  1589 |   await expect(page.locator("#appearanceTransparentToggle")).toHaveAttribute("aria-checked", "true");
  1590 |   await expect(page.locator(".paper-panel").first()).toHaveCSS("backdrop-filter", "blur(12.8px) saturate(1.22)");
  1591 |   await page.reload();
  1592 |   await expect(page.locator("#appearanceContrastRange")).toHaveValue("30");
  1593 |   await expect(page.locator("html")).toHaveClass(/transparency-mode/);
  1594 | 
  1595 |   await page.locator("#appearanceTransparentToggle").click();
  1596 |   await expect(page.locator("html")).not.toHaveClass(/transparency-mode/);
  1597 |   await expect(page.locator(".paper-panel").first()).toHaveCSS("backdrop-filter", "none");
  1598 | });
  1599 | 
  1600 | test("设置：供应商表单与 Key 加密提示", async ({ page }) => {
  1601 |   await seedAndLoad(page, { hash: "#/settings/providers" });
  1602 |   await page.goto("/");
  1603 |   await expect(page.locator(".provider-item")).toHaveCount(1);
  1604 |   await page.click("#newProviderBtn");
  1605 |   await expect(page.getByRole("dialog", { name: "添加供应商" })).toBeVisible();
  1606 |   await expect(page.locator('[data-preset="preset-test-responses"]')).toHaveCount(0);
  1607 |   await page.locator('[data-preset="blank-responses"]').click();
  1608 |   await expect(page.locator("#pf-url")).toHaveValue("");
  1609 |   await expect(page.locator("#pf-key")).toBeVisible();
  1610 | });
  1611 | 
  1612 | test("设置：仅保存模型额度，模型改名迁移默认项", async ({ page }) => {
  1613 |   let submittedBody = null;
  1614 |   await page.route("**/api/providers", async (route) => {
  1615 |     if (route.request().method() !== "PUT") {
  1616 |       return route.fulfill({ contentType: "application/json", body: JSON.stringify({ providers: [] }) });
  1617 |     }
  1618 |     submittedBody = route.request().postDataJSON();
  1619 |     return route.fulfill({
  1620 |       contentType: "application/json",
  1621 |       body: JSON.stringify({ ok: true, provider: { ...submittedBody, id: "p-demo", hasKeyConfigured: false } })
  1622 |     });
  1623 |   });
  1624 |   const state = {
  1625 |     ...SEED_STATE,
  1626 |     providers: [{ ...SEED_STATE.providers[0], hasKeyConfigured: false }]
  1627 |   };
  1628 |   await seedAndLoad(page, { state, hash: "#/settings/providers" });
  1629 |   await page.goto("/");
  1630 | 
  1631 |   await expect(page.getByRole("button", { name: /供应商高级设置/ })).toHaveCount(0);
  1632 |   const editModelButton = page.locator('[data-model-row="demo-model"] [aria-label="编辑模型"]');
  1633 |   await editModelButton.click();
  1634 |   const dialog = page.getByRole("dialog", { name: "编辑模型配置" });
  1635 |   await expect(dialog).toBeVisible();
  1636 |   await expect(dialog.locator("#model-id")).toBeFocused();
  1637 |   await page.keyboard.press("Escape");
  1638 |   await expect(dialog).toHaveCount(0);
  1639 |   await expect(editModelButton).toBeFocused();
  1640 |   await editModelButton.click();
  1641 |   await expect(dialog).toBeVisible();
  1642 |   await expect(dialog.locator("#model-id")).toHaveValue("demo-model");
  1643 |   await expect(dialog.locator("#model-maxTokens")).toBeDisabled();
```