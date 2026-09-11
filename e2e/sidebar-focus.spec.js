import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("tribblebook-ui-preferences-v1")) return;
    localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ appearanceMode: "light" }));
    localStorage.setItem("tribblebook-v6-state", JSON.stringify({
      version: "2.5.1", providers: [], activeConversationId: "reading", activeProviderId: "",
      conversations: [{ id: "reading", title: "把今天的注意力留给重要的事", model: "demo-model", createdAt: Date.now(), updatedAt: Date.now(), messages: [
        { id: "question", role: "user", content: "帮我整理一下今天的工作重点。", createdAt: Date.now() },
        { id: "answer", parentId: "question", role: "assistant", content: "## 先完成一件重要的事\n\n把最需要思考的工作放在上午，留出一段完整、不被打断的时间。\n\n- 明确今天最重要的交付。\n- 将资料和问题集中在当前对话。\n- 完成后再处理零散消息。\n\n留一点空白，让思路有继续生长的空间。", createdAt: Date.now() }
      ] }]
    }));
  });
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, providers: [] }) }));
  await page.goto("/");
  await expect(page.locator("#appShell")).toBeVisible();
});

test("desktop sidebar interpolates, reverses and preserves focus and preference", async ({ page }) => {
  const stage = page.locator(".stage");
  await expect(page.locator("#archiveDrawer")).toBeVisible();
  const initial = await stage.boundingBox();
  const middle = await page.evaluate(async () => {
    document.getElementById("archivesCollapseBtn").click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const drawer = getComputedStyle(document.getElementById("archiveDrawer"));
    return { x: document.querySelector(".stage").getBoundingClientRect().x, display: drawer.display, visibility: drawer.visibility, opacity: Number(drawer.opacity) };
  });
  expect(middle.x).toBeGreaterThan(0);
  expect(middle.x).toBeLessThan(initial.x);
  expect(middle.display).not.toBe("none");
  expect(middle.visibility).toBe("visible");
  expect(middle.opacity).toBeGreaterThan(0);
  expect(middle.opacity).toBeLessThan(1);
  // Reverse the transition while the sidebar is still moving.
  await page.locator("#railExpandBtn").evaluate(el => el.click());
  await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "full");
  await expect.poll(async () => (await stage.boundingBox()).x).toBe(initial.x);
  await page.screenshot({ animations: "disabled", path: "test-results/focus-desktop-light.png" });
  await page.locator("#archivesCollapseBtn").click();
  await expect(page.locator("#archiveDrawer")).toBeHidden();
  await expect(page.locator("#archiveDrawer")).toHaveAttribute("inert", "");
  await expect(page.locator("#railExpandBtn")).toBeFocused();
  await expect.poll(async () => (await stage.boundingBox()).x).toBe(56);
  await page.screenshot({ animations: "disabled", path: "test-results/focus-collapsed.png" });
  await page.reload();
  await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "collapsed");
  await page.keyboard.press("Meta+k");
  await expect(page.locator("#searchInput")).toBeFocused();
  await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "full");
});

test("settings remains reachable without footer appearance and version controls", async ({ page }) => {
  await expect(page.locator("#appearanceModeBtn, .sidebar-version")).toHaveCount(0);
  await page.locator(".sidebar-settings").click();
  await expect(page.locator("#archiveDrawer")).toBeHidden();
  await expect.poll(async () => (await page.locator(".stage").boundingBox()).x).toBe(0);
  await page.getByRole("button", { name: "返回对话", exact: true }).click();
  await expect(page.locator("#archiveDrawer")).toBeVisible();
  await page.locator("#archivesCollapseBtn").click();
  await page.locator('.compact-rail [data-nav="settings"]').click();
  await expect(page.locator("#page-settings")).toBeVisible();
});

test("tablet and mobile drawers close without hidden keyboard targets or overflow", async ({ page }) => {
  for (const width of [900, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator("#appShell")).toHaveAttribute("data-archives", "rail");
    await expect.poll(async () => (await page.locator(".stage").boundingBox()).width).toBe(width > 720 ? width - 56 : width);
    const toggle = page.locator(width > 720 ? "#railExpandBtn" : "#drawerToggleBtn");
    await toggle.click();
    await expect(page.locator("#archiveDrawer")).toBeVisible();
    await expect(page.locator("#archiveDrawer")).not.toHaveAttribute("inert", "");
    await page.locator("#archivesCollapseBtn").click();
    await expect(page.locator("#archiveDrawer")).toBeHidden();
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect((await page.locator(".stage-header").boundingBox()).height).toBeLessThanOrEqual(64);
    if (width === 390) await page.screenshot({ animations: "disabled", path: "test-results/focus-mobile.png" });
    await page.keyboard.press("Meta+k");
    await expect(page.locator("#searchInput")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#archiveDrawer")).toBeHidden();
  }
});

test("reduced motion and focus shortcut settle immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Meta+Backslash");
  await expect(page.locator("#archiveDrawer")).toBeHidden();
  expect(await page.locator("#appShell").evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
  await page.keyboard.press("Meta+Backslash");
  await expect(page.locator("#archivesCollapseBtn")).toBeFocused();
});

test("compact shortcuts search, create and import; settings hover is flat", async ({ page }) => {
  const settings = page.locator(".sidebar-settings");
  expect(await settings.evaluate(el => getComputedStyle(el).boxShadow)).toBe("none");
  await settings.hover();
  expect(await settings.evaluate(el => getComputedStyle(el).boxShadow)).toBe("none");
  await page.locator("#archivesCollapseBtn").click();
  await page.locator("#railSearchBtn").click();
  await expect(page.locator("#searchInput")).toBeFocused();
  await page.locator("#searchInput").fill("找不到的对话");
  await expect(page.locator(".empty-list-note")).toContainText("没有匹配");
  await page.locator("#searchInput").fill("");
  await page.locator("#archivesCollapseBtn").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#railImportBtn").click();
  await chooser;
  await page.locator("#railNewBtn").click();
  await expect(page.locator("#stageTitle")).toHaveText("新对话");
});


test("relative age yields to a flat menu on hover and keyboard focus", async ({ page }) => {
  const row = page.locator('.conversation-item[data-conversation-id="reading"]');
  const menu = row.locator('[data-conv-action="menu"]');
  await page.mouse.move(800, 100);
  await expect(row.locator('.conv-meta')).toHaveText('今天');
  await expect(menu).toBeHidden();
  await row.hover();
  await expect(menu).toBeVisible();
  await expect(row.locator('.conv-meta')).toBeHidden();
  for (const element of [row.locator('.conv-actions'), menu]) {
    expect(await element.evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
    expect(await element.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  }
  await page.screenshot({ path: 'test-results/refined-hover.png' });
  await menu.click();
  await expect(row).toHaveClass(/menu-open/);
  await page.screenshot({ path: 'test-results/refined-menu.png' });
  await page.keyboard.press('Escape');
  await page.mouse.move(800, 100);
  await row.focus();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(menu).toBeFocused();
  expect(await page.locator('.composer-paper').evaluate(el => getComputedStyle(el).borderRadius)).toBe('32px');
});


test("soft surfaces remain coherent in dark mode and settings", async ({ page }) => {
  await page.evaluate(() => window.ClawboxThemeAPI.setAppearance('dark'));
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  await page.mouse.move(800, 100);
  await page.screenshot({ path: 'test-results/refined-dark.png' });
  await page.evaluate(() => window.ClawboxThemeAPI.setAppearance('light'));
  await page.locator('.sidebar-settings').click();
  await page.screenshot({ path: 'test-results/refined-settings.png' });
});


test("archived palette cannot restore black hover, heavy shadows or sharp corners", async ({ page }) => {
  // Reproduce an imported theme overriding the new default tokens on :root.
  await page.evaluate(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries({
      '--canvas-mid': '#FDF6E3', '--surface-content': '#FFF9E8',
      '--paper-subtle': '#FFF9E8', '--label': '#5C6A72',
      '--control-hover': '#000000', '--icon-btn-hover-bg': '#000000',
      '--radius-xs': '4px', '--radius-sm': '6px', '--radius-md': '12px', '--radius-lg': '16px',
      '--shadow-ink': 'rgba(0,0,0,0.25)', '--shadow-ink-strong': 'rgba(0,0,0,0.4)',
      '--paper-shadow': '0 6px 18px var(--shadow-ink)',
      '--paper-shadow-raised': '0 10px 30px var(--shadow-ink-strong)'
    })) root.style.setProperty(key, value);
  });
  for (const [selector, name] of [['.sidebar-settings', 'settings'], ['#attachBtn', 'attachment']]) {
    const button = page.locator(selector);
    await button.hover();
    await expect(button).toHaveCSS('box-shadow', 'none');
    await expect.poll(() => button.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('color(srgb 0.360784 0.415686 0.447059 / 0.07)');
    await page.screenshot({ path: `test-results/legacy-${name}-hover.png` });
  }
  await expect(page.locator('.composer-paper')).toHaveCSS('border-radius', '32px');
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--shadow-ink-strong').trim())).toBe('rgb(0 0 0 / 0.09)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(253, 246, 227)');
});
