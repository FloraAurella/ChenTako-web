import { test, expect } from "@playwright/test";

const projects = [{ id: "a", name: "写作计划", createdAt: 1 }, { id: "b", name: "产品设计", createdAt: 2 }];
const chat = (id, projectId = null, updatedAt = 100) => ({ id, projectId, title: `聊天 ${id}`, createdAt: Date.now() - (1000 - updatedAt) * 60000, updatedAt: Date.now() - (1000 - updatedAt) * 60000, providerId: "project-provider", model: "demo-model", messages: [{ id: `${id}-m`, role: "user", content: `内容 ${id}`, createdAt: updatedAt }], draft: "" });
const seed = { projects, providers: [{ id: "project-provider", displayName: "测试供应商", defaultModel: "demo-model", models: ["demo-model"], baseUrl: "https://api.example.com/v1", enabled: true, saveChats: true, hasKeyConfigured: true }], activeProviderId: "project-provider", activeConversationId: "u", conversations: [chat("u"), ...Array.from({ length: 7 }, (_, i) => chat(`a${i}`, "a", 200 - i))] };

async function load(page, state = seed) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem("project-test-seeded")) {
      localStorage.setItem("tribblebook-v6-state", JSON.stringify(value));
      localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ appearanceMode: "light" }));
      localStorage.setItem("project-test-seeded", "true");
    }
  }, state);
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/providers", route => route.fulfill({ json: { providers: [] } }));
  await page.goto("/");
  await expect(page.locator("#projectSelectorBtn")).toBeEnabled();
}
const project = (page, id) => page.locator(`[data-project-id="${id}"]`);
async function openProjectSelection(page) {
  if (await page.locator("#projectSelectorBtn").isVisible()) {
    await page.locator("#projectSelectorBtn").click();
  } else {
    const row = page.locator('.conversation-item.is-selected');
    await row.focus();
    await row.locator('[data-conv-action="menu"]').click();
    await page.getByRole('menuitem', { name: '移至项目', exact: true }).click();
  }
}
async function selectProject(page, name) {
  await openProjectSelection(page);
  await page.getByRole("menuitemradio", { name, exact: true }).click();
  await expect(page.locator("#projectSelectorBtn")).toContainText(name);
}
async function saveName(page, name) {
  await page.locator(".dialog-input").fill(name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".dialog-card")).toHaveCount(0);
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tribblebook-v6-state")));

test("项目分类：分区、五条限制、搜索与折叠恢复", async ({ page }) => {
  await load(page);
  await expect(page.locator(".filter-chip")).toHaveCount(0);
  await expect(page.locator('[data-section="chats"] .conversation-item')).toHaveCount(1);
  await expect(project(page, "a").locator(".conversation-item")).toHaveCount(5);
  await project(page, "a").getByRole("button", { name: "展开显示" }).click();
  await expect(project(page, "a").locator(".conversation-item")).toHaveCount(7);
  await project(page, "a").getByRole("button", { name: "收起显示" }).click();
  await project(page, "a").locator(".project-toggle").click();
  await expect(project(page, "a").locator(".conversation-item")).toHaveCount(0);
  await page.locator("#searchInput").fill("写作计划");
  await expect(project(page, "a").locator(".conversation-item")).toHaveCount(7);
  await page.locator("#searchInput").fill("");
  await expect(project(page, "a").locator(".conversation-item")).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).projectSidebar?.collapsedProjectIds || []).toContain("a");
  await page.reload();
  await expect(project(page, "a").locator(".project-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#searchInput").fill("a6");
  await page.locator('[data-conversation-id="a6"]').click();
  await page.locator("#searchInput").fill("");
  // Opening a result is an explicit navigation: keep it visible when search ends.
  await expect(project(page, "a").locator(".project-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(project(page, "a").locator('[data-conversation-id="a6"]')).toBeVisible();
});

test("项目管理：创建、移动、重命名、删除及刷新保留", async ({ page }) => {
  await load(page);
  await page.locator("#composerInput").fill("尚未发送的草稿");
  await selectProject(page, "产品设计");
  await expect(project(page, "b").locator('[data-conversation-id="u"]')).toBeVisible();
  await expect(page.locator("#composerInput")).toHaveValue("尚未发送的草稿");
  await expect(page.locator("#composerInput")).toBeFocused();
  await expect(page.locator("#messageList")).toContainText("内容 u");
  await project(page, "b").locator(".project-row").hover();
  await project(page, "b").locator('[data-project-action="menu"]').click();
  await page.getByRole("menuitem", { name: "重命名项目" }).click();
  await saveName(page, "产品设计新版");
  await expect(page.locator("#projectSelectorBtn")).toContainText("产品设计新版");
  await expect(page.locator("#projectSelectorBtn")).toBeHidden();
  await openProjectSelection(page);
  await page.getByRole("menuitem", { name: "新建项目", exact: true }).click();
  await saveName(page, "选择器新项目");
  await expect(page.locator("#projectSelectorBtn")).toContainText("选择器新项目");
  await expect(page.locator("#messageList")).toContainText("内容 u");
  const currentProject = page.locator('.sidebar-project').filter({ has: page.locator('.project-toggle', { hasText: "选择器新项目" }) });
  await currentProject.locator(".project-row").hover();
  await currentProject.locator('[data-project-action="menu"]').click();
  await page.getByRole("menuitem", { name: "删除项目" }).click();
  await expect(page.locator(".dialog-message")).toContainText("全部聊天会保留");
  await page.locator('.dialog-card [data-role="confirm"]').click();
  await expect(page.locator("#projectSelectorBtn")).toContainText("无项目");
  await expect(page.locator('[data-section="chats"] [data-conversation-id="u"]')).toBeVisible();
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await saveName(page, "侧栏新项目");
  await expect(page.locator("#projectSelectorBtn")).toContainText("侧栏新项目");
  await expect(page.locator("#composerInput")).toHaveValue("");
  await expect(page.locator(".empty-stage")).toBeVisible();
  await expect.poll(async () => (await saved(page)).projects.map(p => p.name)).toEqual(["写作计划", "产品设计新版", "侧栏新项目"]);
  await page.reload();
  await expect(page.locator("#projectSelectorBtn")).toContainText("侧栏新项目");
});

test("新建继承当前项目、显式跨项目及无项目；草稿和附件留在原聊天", async ({ page }) => {
  await load(page);
  await page.locator('[data-conversation-id="a3"]').click();
  await page.locator("#newConversationBtn").click();
  await expect(page.locator("#projectSelectorBtn")).toContainText("写作计划");
  const firstId = await page.locator('.conversation-item.is-selected').getAttribute('data-conversation-id');
  await page.locator("#newConversationBtn").click();
  await expect(page.locator('.conversation-item.is-selected')).toHaveAttribute('data-conversation-id', firstId);
  await page.locator("#composerInput").fill("项目 A 草稿");
  await page.locator("#attachmentInput").setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("待发送附件") });
  await expect(page.locator("#composerChips")).toContainText("note.txt");
  await project(page, "b").locator(".project-row").hover();
  await project(page, "b").locator('[data-project-action="new-chat"]').click();
  await expect(page.locator("#projectSelectorBtn")).toContainText("产品设计");
  await expect(page.locator("#composerInput")).toHaveValue("");
  await expect(page.locator("#composerChips")).toBeHidden();
  await page.locator(`[data-conversation-id="${firstId}"]`).click();
  await expect(page.locator("#composerInput")).toHaveValue("项目 A 草稿");
  await expect(page.locator("#composerChips")).toContainText("note.txt");
  await selectProject(page, "无项目");
  await page.keyboard.press("Meta+n");
  await expect(page.locator("#projectSelectorBtn")).toContainText("无项目");
  await expect(page.locator("#composerInput")).toHaveValue("");
  await expect(page.locator("#composerChips")).toBeHidden();
});

test("项目选择器键盘、长名称和移动端不溢出", async ({ page }) => {
  await load(page, { ...seed, projects: [{ ...projects[0], name: "长名称".repeat(20) }, projects[1]] });
  await expect(page.locator("#projectSelectorBtn")).toBeHidden();
  await page.locator("#newConversationBtn").click();
  await expect(page.locator("#projectSelectorBtn")).toBeVisible();
  await page.locator("#projectSelectorBtn").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "无项目", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("#projectSelectorBtn")).toContainText("长名称");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.locator("#projectSelectorBtn").click();
    await expect(page.locator(".project-picker")).toBeVisible();
    const box = await page.locator(".project-picker").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await expect(page.locator("#projectSelectorBtn")).toBeFocused();
  }
  await page.screenshot({ path: "test-results/projects-mobile.png", animations: "disabled" });
});

test("项目移动期间保留输入节点、附件、消息节点与正在生成的回复", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('/api/chat')) return originalFetch(input, init);
      window.projectRequest = JSON.parse(init.body);
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({ start(controller) {
        const frame = (name, data) => controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
        frame('chat.stream.started', { version: 1, providerId: 'project-provider', reasoningKind: 'thinking' });
        frame('chat.content.delta', { delta: '第一段正在生成' });
        window.finishProjectStream = () => {
          frame('chat.content.delta', { delta: '，移动后继续完成。' });
          frame('chat.stream.completed', { finishReason: 'stop' });
          controller.close();
        };
      } }), { headers: { 'Content-Type': 'text/event-stream' } });
    };
  });
  await load(page, { ...seed, conversations: seed.conversations.map(c => c.id === 'u' ? { ...c, messages: [] } : c) });
  await expect(page.locator('#projectSelectorBtn')).toBeVisible();
  await page.locator('#composerInput').fill('测试移动时继续回答');
  await expect(page.locator('#projectSelectorBtn')).toBeVisible();
  await page.locator('#sendBtn').click();
  await expect(page.locator('#messageList')).toContainText('第一段正在生成');
  await expect(page.locator('#projectSelectorBtn')).toBeHidden();
  await page.locator('#composerInput').fill('下一条草稿');
  await page.locator('#attachmentInput').setInputFiles({ name: 'stream-note.txt', mimeType: 'text/plain', buffer: Buffer.from('保留附件') });
  await expect(page.locator('#composerChips')).toContainText('stream-note.txt');
  await page.evaluate(() => {
    window.projectInputNode = document.getElementById('composerInput');
    window.projectMessageNode = document.querySelector('.message-entry');
  });
  await selectProject(page, '产品设计');
  expect(await page.evaluate(() => window.projectInputNode === document.getElementById('composerInput') && window.projectMessageNode === document.querySelector('.message-entry'))).toBe(true);
  await expect(page.locator('#composerInput')).toHaveValue('下一条草稿');
  await expect(page.locator('#composerChips')).toContainText('stream-note.txt');
  await expect(project(page, 'b').locator('.conv-live')).toHaveCount(1);
  await page.evaluate(() => window.finishProjectStream());
  await expect(page.locator('#messageList')).toContainText('第一段正在生成，移动后继续完成。');
  await expect(project(page, 'b').locator('.conv-live')).toHaveCount(0);
  expect(await page.evaluate(() => window.projectRequest.model)).toBe('demo-model');
  await expect.poll(async () => (await saved(page)).conversations.find(c => c.id === 'u')?.projectId).toBe('b');
  await page.screenshot({ path: 'test-results/projects-desktop.png', animations: 'disabled' });
});

test("聊天菜单移动、项目内置顶与活动聊天超过五条时可见", async ({ page }) => {
  await load(page, { ...seed, activeConversationId: 'a6', conversations: seed.conversations.map(c => c.id === 'a5' ? { ...c, pinned: true } : c) });
  await expect(page.locator('.conversation-item[data-conversation-id="a6"]')).toBeVisible();
  await expect(project(page, 'a').locator('.conversation-item').first()).toHaveAttribute('data-conversation-id', 'a5');
  await page.locator('.conversation-item[data-conversation-id="a6"]').focus();
  await page.locator('[data-conversation-id="a6"] [data-conv-action="menu"]').click();
  await page.getByRole('menuitem', { name: '移至项目', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '产品设计', exact: true }).click();
  await expect(project(page, 'b').locator('[data-conversation-id="a6"]')).toBeVisible();
  await expect(page.locator('#projectSelectorBtn')).toContainText('产品设计');
  await page.locator('#searchInput').fill('不存在的名称');
  await page.locator('#newConversationBtn').click();
  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('.conversation-item.is-selected')).toBeVisible();
  await expect(page.locator('#projectSelectorBtn')).toContainText('产品设计');
});

test("空白聊天带附件时不得复用，桌面和移动端项目列表布局", async ({ page }) => {
  await load(page, { ...seed, activeConversationId: 'empty', conversations: [{ ...chat('empty', 'a'), messages: [] }, ...seed.conversations] });
  await page.locator('#attachmentInput').setInputFiles({ name: 'only.txt', mimeType: 'text/plain', buffer: Buffer.from('只有附件') });
  await expect(page.locator('#composerChips')).toContainText('only.txt');
  await page.locator('#newConversationBtn').click();
  await expect(page.locator('.conversation-item.is-selected')).not.toHaveAttribute('data-conversation-id', 'empty');
  await expect(page.locator('#composerChips')).toBeHidden();
  await page.locator('[data-conversation-id="empty"]').click();
  await expect(page.locator('#composerChips')).toContainText('only.txt');
  await page.screenshot({ path: 'test-results/projects-sidebar-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#drawerToggleBtn').click();
  await expect(project(page, 'a')).toBeVisible();
  await expect(project(page, 'b')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'test-results/projects-sidebar-mobile.png', animations: 'disabled' });
});
