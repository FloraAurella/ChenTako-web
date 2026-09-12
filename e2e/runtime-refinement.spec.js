import { test, expect } from "@playwright/test";
test.use({ video: { mode: "on", size: { width: 1280, height: 800 } } });
const model = "deepseek-v4-flash-vision-exp";
async function seed(page, { scheme = "light", reset = "high", projectOverride, models, legacy = false } = {}) {
  await page.addInitScript(({ model, scheme, reset, projectOverride, models }) => {
    if (localStorage.getItem("runtime-test-seeded")) return;
    localStorage.setItem("runtime-test-seeded", "1");
    localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ appearanceMode: scheme }));
    // 思考强度权威数据是全局 chatConfig 与项目 configOverrides；
    // 供应商配置不承载默认推理强度，settingsSchemaVersion 声明配置已按当前模型归一。
    const provider = { id: "deepseek", displayName: "DeepSeek", enabled: true, hasKeyConfigured: true,
      baseUrl: "https://example.com/v1", responseFormat: "openai-compatible", defaultModel: model,
      models: models || ["deepseek-v4-flash", model, "deepseek-v4-pro", "1"], saveChats: true };
    const chatConfig = { defaultReasoningEffort: reset };
    const projects = projectOverride
      ? [{ id: "proj-effort", name: "强度项目", configOverrides: { defaultReasoningEffort: projectOverride }, createdAt: Date.now() }]
      : [];
    localStorage.setItem("tribblebook-v6-state", JSON.stringify({ version: "2.5.1", settingsSchemaVersion: 1,
      chatConfig, projects, providers: [provider],
      activeProviderId: provider.id, activeConversationId: "demo", preferredReasoningEffort: "medium",
      conversations: [{ id: "demo", title: "选择适合当前任务的模型", providerId: provider.id, model,
        projectId: projectOverride ? "proj-effort" : null,
        reasoningEffort: "medium", messages: [], createdAt: Date.now(), updatedAt: Date.now() }] }));
  }, { model, scheme, reset, projectOverride, models });
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, providers: [] }) }));
  await page.goto("/");
  await expect(page.locator("#runtimeBtn")).toBeVisible();
  if (legacy) await page.evaluate(() => {
    Object.entries({ "--canvas": "#FDF6E3", "--surface-content": "#FFF9E8", "--accent": "#93B259",
      "--separator": "#D8D0BD", "--effort-track": "#000", "--radius-md": "80px", "--context-soft": "#000", "--fill-selected": "#000" })
      .forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  });
}
async function open(page, panel) {
  await page.locator("#runtimeBtn").click();
  if (panel) await page.locator(`[data-runtime-open="${panel}"]`).click();
}
async function shot(page, info, name) {
  await page.locator(".runtime-popover").screenshot({ path: info.outputPath(name + ".png"), animations: "disabled" });
}
test("root geometry and compact model list", async ({ page }, info) => {
  await seed(page, { legacy: true }); await open(page);
  const card = page.locator(".runtime-popover");
  await expect(card).toHaveCSS("border-radius", "16px");
  expect(await page.locator("[data-runtime-model-value]").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await shot(page, info, "root");
  for (const panel of ["model", "effort"]) {
    await page.locator(`[data-runtime-open="${panel}"]`).hover();
    await shot(page, info, "hover-" + panel);
    await expect(page.locator(`[data-runtime-open="${panel}"]`)).toHaveCSS("border-radius", "10px");
  }
  await page.locator('[data-runtime-open="model"]').click();
  await expect(page.locator(".model-popover .option-sub")).toHaveCount(0);
  await expect(page.locator(".model-popover .is-selected")).toBeFocused();
  await expect(page.locator(".model-popover .group-label")).toHaveText("DeepSeek");
  expect((await card.boundingBox()).height).toBeLessThanOrEqual(190);
  await shot(page, info, "models");
  await page.keyboard.press("End");
  await expect(page.locator('[data-model="1"]')).toBeFocused();
  await page.keyboard.press("Home"); await page.keyboard.press("Enter");
  await expect(card).toHaveCount(0);
  await expect(page.locator("#runtimeBtn")).toBeFocused();
  await page.reload();
  await expect(page.locator("#modelValue")).toHaveText("deepseek-v4-flash");
});
// 权威映射：low=0、medium=1、high=2、xhigh=3、max=4。
// inherited：全局 chatConfig high；override：项目 configOverrides xhigh 覆盖；
// fallback：非法配置值经归一化回退 medium。
for (const [name, opts, expected, label] of [
  ["inherited", { reset: "high" }, "2", "高"],
  ["override", { reset: "high", projectOverride: "xhigh" }, "3", "极高"],
  ["fallback", { reset: "bogus" }, "1", "中等"]
]) test("reset " + name, async ({ page }) => {
  await seed(page, opts); await open(page, "effort");
  const rail = page.locator(".effort-rail");
  // 初始为继承自全局／项目配置的有效值，无会话覆盖
  await expect(rail).toHaveAttribute("aria-valuenow", expected);
  await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
  // 手动选择产生会话级覆盖
  await rail.press("End");
  await expect(page.locator("[data-effort-source]")).toHaveText("当前会话自定义");
  // 重置清除会话覆盖，重新继承当前全局／项目配置
  await page.locator("[data-effort-reset]").click();
  await expect(rail).toHaveAttribute("aria-valuenow", expected);
  await expect(rail).toHaveAttribute("aria-valuetext", label);
  await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
  // 会话级覆盖刷新后保留，展示最终有效值
  await rail.press("Home"); await rail.press("ArrowRight");
  await expect(rail).toHaveAttribute("aria-valuenow", "1");
  await page.keyboard.press("Escape");
  await expect(page.locator("#runtimeBtn")).toBeFocused();
  await page.reload(); await open(page, "effort");
  await expect(rail).toHaveAttribute("aria-valuenow", "1");
  await page.locator("[data-effort-reset]").click();
  await expect(rail).toHaveAttribute("aria-valuenow", expected);
});
test("pointer stops and rapid reversal", async ({ page }) => {
  await seed(page); await open(page, "effort");
  const rail = page.locator(".effort-rail");
  for (let index = 0; index < 5; index++) {
    const width = await rail.evaluate((element) => element.clientWidth);
    await rail.click({ position: { x: 14 + index * (width - 28) / 4, y: 22 } });
    await expect(rail).toHaveAttribute("aria-valuenow", String(index));
    await expect.poll(() => rail.evaluate((element, stopIndex) => {
      const thumb = element.querySelector(".effort-rail-thumb").getBoundingClientRect();
      const railRect = element.getBoundingClientRect();
      const expected = railRect.left + 14 + stopIndex * (element.clientWidth - 28) / 4;
      return Math.abs(thumb.left + thumb.width / 2 - expected);
    }, index)).toBeLessThan(1);
  }
  const box = await rail.boundingBox();
  await page.mouse.move(box.x + 14, box.y + 22); await page.mouse.down();
  await page.mouse.move(box.x + box.width + 50, box.y + 22, { steps: 12 });
  await expect(rail).toHaveAttribute("aria-valuenow", "4");
  await page.mouse.move(box.x - 20, box.y + 22, { steps: 12 });
  await expect(rail).toHaveAttribute("aria-valuenow", "0");
  await page.mouse.up();
  await expect(rail).not.toHaveClass(/is-dragging/);
  await page.mouse.move(box.x + box.width, box.y + 22);
  await expect(rail).toHaveAttribute("aria-valuenow", "0");
});
for (const scheme of ["light", "dark"]) test("appearance " + scheme, async ({ page }, info) => {
  await seed(page, { scheme, legacy: scheme === "light" }); await open(page, "effort");
  const rail = page.locator(".effort-rail");
  for (const [index, label] of [[0, "low"], [2, "high"], [3, "xhigh"], [4, "max"]]) {
    const box = await rail.boundingBox();
    await rail.click({ position: { x: 14 + (box.width - 28) * index / 4, y: 22 } });
    await shot(page, info, scheme + "-" + label);
  }
  await expect(page.locator(".effort-current")).toHaveCSS("color", "rgb(214, 93, 177)");
  const speed = await page.locator(".effort-particle").first().evaluate(el => {
    const style = getComputedStyle(el);
    return -parseFloat(style.getPropertyValue("--particle-travel")) / parseFloat(style.animationDuration);
  });
  expect(speed).toBeCloseTo(120, 1);
  await page.evaluate(() => document.documentElement.style.setProperty("--effort-max-accent", "#123456"));
  await expect(page.locator(".effort-current")).toHaveCSS("color", "rgb(18, 52, 86)");
  await page.evaluate(() => document.documentElement.style.removeProperty("--effort-max-accent"));
  await expect(page.locator(".effort-rail-track")).not.toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.setViewportSize({ width: 375, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".effort-particle").first()).toHaveCSS("animation-name", "none");
  const box = await page.locator(".effort-popover").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(14); expect(box.x + box.width).toBeLessThanOrEqual(361);
  await page.screenshot({ path: info.outputPath(scheme + "-mobile.png") });
});
test("long names and scroll", async ({ page }) => {
  await seed(page, { models: [model, "very-long-model-".repeat(10), ...Array.from({ length: 30 }, (_, i) => "model-" + i)] });
  await open(page, "model");
  expect((await page.locator(".model-popover").boundingBox()).height).toBeLessThanOrEqual(400);
  expect(await page.locator(".option-title").nth(1).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press("End");
  await expect(page.locator('[data-model="model-29"]')).toBeFocused();
});
test.describe("motion demonstration", () => {

  test("particles clicks drag reset", async ({ page }) => {
    await seed(page, { legacy: true }); await open(page, "effort");
    const rail = page.locator(".effort-rail"), box = await rail.boundingBox();
    // Deliberate holds make continuous particle flow visible in the delivered video.
    for (const fraction of [0.5, 0.75, 1]) {
      await rail.click({ position: { x: 14 + (box.width - 28) * fraction, y: 22 } });
      await page.waitForTimeout(1300);
    }
    await page.mouse.move(box.x + box.width - 14, box.y + 22); await page.mouse.down();
    await page.mouse.move(box.x + 14, box.y + 22, { steps: 45 });
    await page.mouse.move(box.x + box.width - 14, box.y + 22, { steps: 45 }); await page.mouse.up();
    await page.locator("[data-effort-reset]").click(); await page.waitForTimeout(1600);
    await expect(rail).toHaveAttribute("aria-valuetext", "高");
  });
});
test.describe("touch cancellation", () => {
  // 默认上下文继承 Playwright baseURL（端口由 playwright.config 决定），测试不复制开发服务器常量。
  test.use({ hasTouch: true, viewport: { width: 375, height: 740 } });
  test("touch cancellation and visibility cleanup", async ({ page }) => {
    const context = page.context();
    await seed(page); await open(page, "effort");
    const rail = page.locator(".effort-rail"), box = await rail.boundingBox();
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 14, y: box.y + 22 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + box.width - 14, y: box.y + 22 }] });
    await expect(rail).toHaveAttribute("aria-valuenow", "4");
    await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await expect(rail).not.toHaveClass(/is-dragging/);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 14, y: box.y + 22 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(rail).toHaveAttribute("aria-valuenow", "0");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".effort-particle").first()).toHaveCSS("animation-play-state", "paused");
    await page.keyboard.press("Escape");
    await expect(page.locator(".effort-particle")).toHaveCount(0);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await open(page, "effort");
    await expect(page.locator(".effort-particle").first()).toHaveCSS("animation-play-state", "running");
  });
});

test("thumb hover and nearest-stop settling", async ({ page }) => {
  await seed(page); await open(page, "effort");
  const rail = page.locator(".effort-rail"), thumb = page.locator(".effort-rail-thumb");
  const box = await rail.boundingBox(), travel = box.width - 28;
  await thumb.hover();
  await expect.poll(() => thumb.evaluate(el => getComputedStyle(el, "::before").transform)).toBe("matrix(1.08, 0, 0, 1.08, 0, 0)");
  for (const [fraction, expected] of [[0.36, "1"], [0.39, "2"]]) {
    const start = await thumb.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 14 + travel * fraction, box.y + 22, { steps: 8 });
    // The nearest stop must settle while the pointer is STILL down.
    await expect.poll(async () => {
      const dragged = await thumb.boundingBox();
      return Math.abs(dragged.x + dragged.width / 2 - (box.x + 14 + travel * Number(expected) / 4));
    }).toBeLessThan(1);
    await page.mouse.up();
    await expect(rail).toHaveAttribute("aria-valuenow", expected);
    await expect.poll(async () => {
      const settled = await thumb.boundingBox();
      return Math.abs(settled.x + settled.width / 2 - (box.x + 14 + travel * Number(expected) / 4));
    }).toBeLessThan(1);
  }
});

test("max color wipes right to left and reverses without restarting", async ({ page }, info) => {
  await seed(page); await open(page, "effort");
  const rail = page.locator(".effort-rail"), fill = page.locator(".effort-rail-fill");
  const box = await rail.boundingBox();
  const clip = () => fill.evaluate(el => getComputedStyle(el, "::before").maskPosition);
  await expect.poll(clip).toBe("0% 0px");
  await rail.click({ position: { x: box.width - 14, y: 22 } });
  // Pause only the color transition at its midpoint to inspect its direction deterministically.
  const midway = await fill.evaluate(el => {
    const animation = el.getAnimations({ subtree: true }).find(a => a.effect?.pseudoElement === "::before");
    if (!animation) throw new Error("Color wipe transition missing");
    animation.pause(); animation.currentTime = 500;
    return getComputedStyle(el, "::before").maskPosition;
  });
  expect(midway).toMatch(/% 0px$/);
  await page.locator(".effort-popover").screenshot({ path: info.outputPath("color-midpoint.png") });
  const left = Number(midway.match(/([\d.]+)%/)[1]);
  expect(left).toBeGreaterThan(0); expect(left).toBeLessThan(100);
  await page.locator("[data-effort-reset]").click();
  await expect.poll(clip).toBe("0% 0px");
  await rail.click({ position: { x: box.width - 14, y: 22 } });
  await expect.poll(clip).toBe("100% 0px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await fill.evaluate(el => parseFloat(getComputedStyle(el, "::before").transitionDuration))).toBeLessThanOrEqual(0.00001);
});
