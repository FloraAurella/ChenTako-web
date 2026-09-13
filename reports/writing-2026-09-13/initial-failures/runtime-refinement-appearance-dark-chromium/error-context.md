# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: runtime-refinement.spec.js >> appearance dark
- Location: e2e/runtime-refinement.spec.js:122:41

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator:  locator('.effort-current')
Expected: "rgb(214, 93, 177)"
Received: "rgb(255, 143, 163)"
Timeout:  5000ms

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for locator('.effort-current')
    14 × locator resolved to <span class="effort-current" data-effort-current="">最大</span>
       - unexpected value "rgb(255, 143, 163)"

```

```yaml
- text: 最大
```

# Test source

```ts
  30  |       "--separator": "#D8D0BD", "--effort-track": "#000", "--radius-md": "80px", "--context-soft": "#000", "--fill-selected": "#000" })
  31  |       .forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  32  |   });
  33  | }
  34  | async function open(page, panel) {
  35  |   await page.locator("#runtimeBtn").click();
  36  |   if (panel) await page.locator(`[data-runtime-open="${panel}"]`).click();
  37  | }
  38  | async function shot(page, info, name) {
  39  |   await page.locator(".runtime-popover").screenshot({ path: info.outputPath(name + ".png"), animations: "disabled" });
  40  | }
  41  | test("root geometry and compact model list", async ({ page }, info) => {
  42  |   await seed(page, { legacy: true }); await open(page);
  43  |   const card = page.locator(".runtime-popover");
  44  |   await expect(card).toHaveCSS("border-radius", "16px");
  45  |   expect(await page.locator("[data-runtime-model-value]").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  46  |   await shot(page, info, "root");
  47  |   for (const panel of ["model", "effort"]) {
  48  |     await page.locator(`[data-runtime-open="${panel}"]`).hover();
  49  |     await shot(page, info, "hover-" + panel);
  50  |     await expect(page.locator(`[data-runtime-open="${panel}"]`)).toHaveCSS("border-radius", "10px");
  51  |   }
  52  |   await page.locator('[data-runtime-open="model"]').click();
  53  |   await expect(page.locator(".model-popover .option-sub")).toHaveCount(0);
  54  |   await expect(page.locator(".model-popover .is-selected")).toBeFocused();
  55  |   await expect(page.locator(".model-popover .group-label")).toHaveText("DeepSeek");
  56  |   expect((await card.boundingBox()).height).toBeLessThanOrEqual(190);
  57  |   await shot(page, info, "models");
  58  |   await page.keyboard.press("End");
  59  |   await expect(page.locator('[data-model="1"]')).toBeFocused();
  60  |   await page.keyboard.press("Home"); await page.keyboard.press("Enter");
  61  |   await expect(card).toHaveCount(0);
  62  |   await expect(page.locator("#runtimeBtn")).toBeFocused();
  63  |   await page.reload();
  64  |   await expect(page.locator("#modelValue")).toHaveText("deepseek-v4-flash");
  65  | });
  66  | // 权威映射：low=0、medium=1、high=2、xhigh=3、max=4。
  67  | // inherited：全局 chatConfig high；override：项目 configOverrides xhigh 覆盖；
  68  | // fallback：非法配置值经归一化回退 medium。
  69  | for (const [name, opts, expected, label] of [
  70  |   ["inherited", { reset: "high" }, "2", "高"],
  71  |   ["override", { reset: "high", projectOverride: "xhigh" }, "3", "极高"],
  72  |   ["fallback", { reset: "bogus" }, "1", "中等"]
  73  | ]) test("reset " + name, async ({ page }) => {
  74  |   await seed(page, opts); await open(page, "effort");
  75  |   const rail = page.locator(".effort-rail");
  76  |   // 初始为继承自全局／项目配置的有效值，无会话覆盖
  77  |   await expect(rail).toHaveAttribute("aria-valuenow", expected);
  78  |   await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
  79  |   // 手动选择产生会话级覆盖
  80  |   await rail.press("End");
  81  |   await expect(page.locator("[data-effort-source]")).toHaveText("当前会话自定义");
  82  |   // 重置清除会话覆盖，重新继承当前全局／项目配置
  83  |   await page.locator("[data-effort-reset]").click();
  84  |   await expect(rail).toHaveAttribute("aria-valuenow", expected);
  85  |   await expect(rail).toHaveAttribute("aria-valuetext", label);
  86  |   await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
  87  |   // 会话级覆盖刷新后保留，展示最终有效值
  88  |   await rail.press("Home"); await rail.press("ArrowRight");
  89  |   await expect(rail).toHaveAttribute("aria-valuenow", "1");
  90  |   await page.keyboard.press("Escape");
  91  |   await expect(page.locator("#runtimeBtn")).toBeFocused();
  92  |   await page.reload(); await open(page, "effort");
  93  |   await expect(rail).toHaveAttribute("aria-valuenow", "1");
  94  |   await page.locator("[data-effort-reset]").click();
  95  |   await expect(rail).toHaveAttribute("aria-valuenow", expected);
  96  | });
  97  | test("pointer stops and rapid reversal", async ({ page }) => {
  98  |   await seed(page); await open(page, "effort");
  99  |   const rail = page.locator(".effort-rail");
  100 |   for (let index = 0; index < 5; index++) {
  101 |     const width = await rail.evaluate((element) => element.clientWidth);
  102 |     await rail.click({ position: { x: 14 + index * (width - 28) / 4, y: 22 } });
  103 |     await expect(rail).toHaveAttribute("aria-valuenow", String(index));
  104 |     await expect.poll(() => rail.evaluate((element, stopIndex) => {
  105 |       const thumb = element.querySelector(".effort-rail-thumb").getBoundingClientRect();
  106 |       const railRect = element.getBoundingClientRect();
  107 |       const expected = railRect.left + 14 + stopIndex * (element.clientWidth - 28) / 4;
  108 |       return Math.abs(thumb.left + thumb.width / 2 - expected);
  109 |     }, index)).toBeLessThan(1);
  110 |   }
  111 |   const box = await rail.boundingBox();
  112 |   await page.mouse.move(box.x + 14, box.y + 22); await page.mouse.down();
  113 |   await page.mouse.move(box.x + box.width + 50, box.y + 22, { steps: 12 });
  114 |   await expect(rail).toHaveAttribute("aria-valuenow", "4");
  115 |   await page.mouse.move(box.x - 20, box.y + 22, { steps: 12 });
  116 |   await expect(rail).toHaveAttribute("aria-valuenow", "0");
  117 |   await page.mouse.up();
  118 |   await expect(rail).not.toHaveClass(/is-dragging/);
  119 |   await page.mouse.move(box.x + box.width, box.y + 22);
  120 |   await expect(rail).toHaveAttribute("aria-valuenow", "0");
  121 | });
  122 | for (const scheme of ["light", "dark"]) test("appearance " + scheme, async ({ page }, info) => {
  123 |   await seed(page, { scheme, legacy: scheme === "light" }); await open(page, "effort");
  124 |   const rail = page.locator(".effort-rail");
  125 |   for (const [index, label] of [[0, "low"], [2, "high"], [3, "xhigh"], [4, "max"]]) {
  126 |     const box = await rail.boundingBox();
  127 |     await rail.click({ position: { x: 14 + (box.width - 28) * index / 4, y: 22 } });
  128 |     await shot(page, info, scheme + "-" + label);
  129 |   }
> 130 |   await expect(page.locator(".effort-current")).toHaveCSS("color", "rgb(214, 93, 177)");
      |                                                 ^ Error: expect(locator).toHaveCSS(expected) failed
  131 |   const speed = await page.locator(".effort-particle").first().evaluate(el => {
  132 |     const style = getComputedStyle(el);
  133 |     return -parseFloat(style.getPropertyValue("--particle-travel")) / parseFloat(style.animationDuration);
  134 |   });
  135 |   expect(speed).toBeCloseTo(120, 1);
  136 |   await page.evaluate(() => document.documentElement.style.setProperty("--effort-max-accent", "#123456"));
  137 |   await expect(page.locator(".effort-current")).toHaveCSS("color", "rgb(18, 52, 86)");
  138 |   await page.evaluate(() => document.documentElement.style.removeProperty("--effort-max-accent"));
  139 |   await expect(page.locator(".effort-rail-track")).not.toHaveCSS("background-color", "rgb(0, 0, 0)");
  140 |   await page.setViewportSize({ width: 375, height: 740 });
  141 |   await page.emulateMedia({ reducedMotion: "reduce" });
  142 |   await expect(page.locator(".effort-particle").first()).toHaveCSS("animation-name", "none");
  143 |   const box = await page.locator(".effort-popover").boundingBox();
  144 |   expect(box.x).toBeGreaterThanOrEqual(14); expect(box.x + box.width).toBeLessThanOrEqual(361);
  145 |   await page.screenshot({ path: info.outputPath(scheme + "-mobile.png") });
  146 | });
  147 | test("long names and scroll", async ({ page }) => {
  148 |   await seed(page, { models: [model, "very-long-model-".repeat(10), ...Array.from({ length: 30 }, (_, i) => "model-" + i)] });
  149 |   await open(page, "model");
  150 |   expect((await page.locator(".model-popover").boundingBox()).height).toBeLessThanOrEqual(400);
  151 |   expect(await page.locator(".option-title").nth(1).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  152 |   await page.keyboard.press("End");
  153 |   await expect(page.locator('[data-model="model-29"]')).toBeFocused();
  154 | });
  155 | test.describe("motion demonstration", () => {
  156 | 
  157 |   test("particles clicks drag reset", async ({ page }) => {
  158 |     await seed(page, { legacy: true }); await open(page, "effort");
  159 |     const rail = page.locator(".effort-rail"), box = await rail.boundingBox();
  160 |     // Deliberate holds make continuous particle flow visible in the delivered video.
  161 |     for (const fraction of [0.5, 0.75, 1]) {
  162 |       await rail.click({ position: { x: 14 + (box.width - 28) * fraction, y: 22 } });
  163 |       await page.waitForTimeout(1300);
  164 |     }
  165 |     await page.mouse.move(box.x + box.width - 14, box.y + 22); await page.mouse.down();
  166 |     await page.mouse.move(box.x + 14, box.y + 22, { steps: 45 });
  167 |     await page.mouse.move(box.x + box.width - 14, box.y + 22, { steps: 45 }); await page.mouse.up();
  168 |     await page.locator("[data-effort-reset]").click(); await page.waitForTimeout(1600);
  169 |     await expect(rail).toHaveAttribute("aria-valuetext", "高");
  170 |   });
  171 | });
  172 | test.describe("touch cancellation", () => {
  173 |   // 默认上下文继承 Playwright baseURL（端口由 playwright.config 决定），测试不复制开发服务器常量。
  174 |   test.use({ hasTouch: true, viewport: { width: 375, height: 740 } });
  175 |   test("touch cancellation and visibility cleanup", async ({ page }) => {
  176 |     const context = page.context();
  177 |     await seed(page); await open(page, "effort");
  178 |     const rail = page.locator(".effort-rail"), box = await rail.boundingBox();
  179 |     const session = await context.newCDPSession(page);
  180 |     await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 14, y: box.y + 22 }] });
  181 |     await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + box.width - 14, y: box.y + 22 }] });
  182 |     await expect(rail).toHaveAttribute("aria-valuenow", "4");
  183 |     await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  184 |     await expect(rail).not.toHaveClass(/is-dragging/);
  185 |     await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 14, y: box.y + 22 }] });
  186 |     await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  187 |     await expect(rail).toHaveAttribute("aria-valuenow", "0");
  188 |     await page.evaluate(() => {
  189 |       Object.defineProperty(document, "hidden", { configurable: true, value: true });
  190 |       document.dispatchEvent(new Event("visibilitychange"));
  191 |     });
  192 |     await expect(page.locator(".effort-particle").first()).toHaveCSS("animation-play-state", "paused");
  193 |     await page.keyboard.press("Escape");
  194 |     await expect(page.locator(".effort-particle")).toHaveCount(0);
  195 |     await page.evaluate(() => {
  196 |       delete document.hidden;
  197 |       document.dispatchEvent(new Event("visibilitychange"));
  198 |     });
  199 |     await open(page, "effort");
  200 |     await expect(page.locator(".effort-particle").first()).toHaveCSS("animation-play-state", "running");
  201 |   });
  202 | });
  203 | 
  204 | test("thumb hover and nearest-stop settling", async ({ page }) => {
  205 |   await seed(page); await open(page, "effort");
  206 |   const rail = page.locator(".effort-rail"), thumb = page.locator(".effort-rail-thumb");
  207 |   const box = await rail.boundingBox(), travel = box.width - 28;
  208 |   await thumb.hover();
  209 |   await expect.poll(() => thumb.evaluate(el => getComputedStyle(el, "::before").transform)).toBe("matrix(1.08, 0, 0, 1.08, 0, 0)");
  210 |   for (const [fraction, expected] of [[0.36, "1"], [0.39, "2"]]) {
  211 |     const start = await thumb.boundingBox();
  212 |     await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  213 |     await page.mouse.down();
  214 |     await page.mouse.move(box.x + 14 + travel * fraction, box.y + 22, { steps: 8 });
  215 |     // The nearest stop must settle while the pointer is STILL down.
  216 |     await expect.poll(async () => {
  217 |       const dragged = await thumb.boundingBox();
  218 |       return Math.abs(dragged.x + dragged.width / 2 - (box.x + 14 + travel * Number(expected) / 4));
  219 |     }).toBeLessThan(1);
  220 |     await page.mouse.up();
  221 |     await expect(rail).toHaveAttribute("aria-valuenow", expected);
  222 |     await expect.poll(async () => {
  223 |       const settled = await thumb.boundingBox();
  224 |       return Math.abs(settled.x + settled.width / 2 - (box.x + 14 + travel * Number(expected) / 4));
  225 |     }).toBeLessThan(1);
  226 |   }
  227 | });
  228 | 
  229 | test("max color wipes right to left and reverses without restarting", async ({ page }, info) => {
  230 |   await seed(page); await open(page, "effort");
```