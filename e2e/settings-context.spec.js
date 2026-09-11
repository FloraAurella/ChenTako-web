import { test, expect } from "@playwright/test";
const provider = { id: "settings-provider", displayName: "示例供应商", baseUrl: "https://example.com/v1", responseFormat: "openai-compatible", models: ["model-a", "model-b"], defaultModel: "model-a", contextWindow: 131072, maxTokens: 8192, hasKeyConfigured: true, systemPrompt: "obsolete-provider-prompt", temperature: 1.9 };
const defaults = { systemPrompt: "聊天默认提示词", streaming: false, inputBudget: null, autoCompress: false, compressionThreshold: 80, defaultReasoningEffort: "medium", temperature: 0.7, topP: 1, saveChats: true, userId: "" };
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tribblebook-v6-state")));
async function load(page, { hash = "#/settings/context", config = {}, project = {}, conversation = {}, legacy = false, scheme = "light" } = {}) {
  const seed = { settingsSchemaVersion: legacy ? undefined : 1, chatConfig: { ...defaults, ...config }, modelCompatibility: {}, providers: [provider], projects: [{ id: "p", name: "写作项目", createdAt: 1, configOverrides: project }], activeProviderId: provider.id, activeConversationId: "c", conversations: [{ id: "c", providerId: provider.id, model: "model-a", messages: [], saveChats: true, ...conversation }] };
  await page.addInitScript(({ seed, scheme }) => {
    if (!localStorage.getItem("settings-test-seeded")) {
      localStorage.setItem("settings-test-seeded", "1");
      localStorage.setItem("tribblebook-v6-state", JSON.stringify(seed));
      localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ themeId: "everforest", appearanceMode: scheme }));
    }
  }, { seed, scheme });
  await page.route("**/api/health", (r) => r.fulfill({ json: { ok: true } }));
  await page.route("**/api/providers", (r) => r.fulfill({ json: { providers: [] } }));
  await page.route("**/api/providers/key*", (r) => r.fulfill({ json: { apiKey: "fixture" } }));
  await page.goto(`/${hash}`);
  await expect(page.locator("#appShell")).toBeVisible();
}
const save = async (page) => { await page.locator(".context-savebar").getByRole("button", { name: "保存更改" }).click(); await expect(page.locator(".context-savebar")).toContainText("配置已保存"); };

test("聊天配置保存、项目空提示词覆盖与继承、重启", async ({ page }) => {
  await load(page, { config: { keepRecentTurns: 6 }, project: { keepRecentTurns: 2 } });
  await expect(page.getByText("保留最近轮数", { exact: true })).toHaveCount(0);
  await page.getByLabel("提示词内容", { exact: true }).fill("统一的新提示词");
  await page.getByLabel("Temperature", { exact: true }).fill("0");
  await save(page);
  await page.getByLabel("选择配置范围").selectOption("p");
  await expect(page.locator("#cc-systemPrompt")).toBeDisabled();
  await page.locator("#context-prompt").getByRole("button", { name: "继承聊天 · 自定义" }).click();
  await page.locator("#cc-systemPrompt").fill("");
  await save(page);
  await expect.poll(async () => (await saved(page)).projects[0].configOverrides).toEqual({ systemPrompt: "" });
  await page.reload();
  await expect(page.locator("#cc-systemPrompt")).toHaveValue("");
  await expect(page.locator("#cc-temperature")).toHaveValue("0");
  await page.getByRole("button", { name: "全部恢复继承" }).click();
  await expect(page.locator("#cc-systemPrompt")).toHaveValue("统一的新提示词");
  await save(page);
});

test("未保存的跨项目导航会询问，取消保留草稿", async ({ page }) => {
  await load(page);
  await page.locator("#cc-systemPrompt").fill("未保存");
  await page.getByLabel("选择配置范围").selectOption("p");
  await expect(page.locator(".dialog-card")).toContainText("有未保存的修改");
  await page.locator('.dialog-card [data-role="cancel"]').click();
  await expect(page).toHaveURL(/settings\/context$/);
  await expect(page.locator("#cc-systemPrompt")).toHaveValue("未保存");
  await page.getByLabel("选择配置范围").selectOption("p");
  await page.locator('.dialog-card [data-role="confirm"]').click();
  await expect(page.locator("#context-scope")).toHaveValue("p");
  await expect(page.locator("#cc-systemPrompt")).toHaveValue("聊天默认提示词");
});

test("新请求使用项目配置而非供应商提示词", async ({ page }) => {
  let body;
  await load(page, { hash: "#/chat", project: { systemPrompt: "项目专属", temperature: 0.2 }, conversation: { projectId: "p" } });
  await page.route("**/api/chat", async (r) => { body = r.request().postDataJSON(); await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "已完成" } }] } }); });
  await page.locator("#composerInput").fill("你好");
  await page.locator("#sendBtn").click();
  await expect.poll(() => body?.chatConfig?.systemPrompt).toBe("项目专属");
  expect(body.chatConfig.temperature).toBe(0.2);
  expect(body.chatConfig.version).toBe(1);
  expect(body.stream).toBe(false);
  expect(JSON.stringify(body)).not.toContain("obsolete-provider-prompt");
  await expect(page.locator("#messageList")).toContainText("已完成");
});

test("达到预算阈值压缩全部已完成历史，保留待发送消息", async ({ page }) => {
  let sent = 0; let compressed;
  const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史内容".repeat(100) }, { id: `a${i}`, role: "assistant", content: "历史回复".repeat(100) }]).flat();
  await load(page, { hash: "#/chat", config: { inputBudget: 1500, autoCompress: true }, conversation: { messages } });
  await page.route("**/api/chat/compress", async (r) => { compressed = r.request().postDataJSON(); await r.fulfill({ json: { summary: "此前讨论了项目计划。" } }); });
  await page.route("**/api/chat", async (r) => { sent++; await r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "继续" } }] } }); });
  await page.locator("#composerInput").fill("接着讲");
  await page.locator("#sendBtn").click();
  await expect.poll(() => sent).toBe(1);
  expect(compressed.messages).toHaveLength(8);
  expect(compressed.messages.every((m) => m.content !== "接着讲")).toBe(true);
  await expect(page.locator("#messageList")).toContainText("继续");
});

test("压缩失败保留草稿，不发送、不无限重试", async ({ page }) => {
  let attempts = 0; let sent = 0;
  const messages = Array.from({ length: 4 }, (_, i) => [{ id: `u${i}`, role: "user", content: "历史".repeat(500) }, { id: `a${i}`, role: "assistant", content: "回复".repeat(500) }]).flat();
  await load(page, { hash: "#/chat", config: { inputBudget: 1000, autoCompress: true }, conversation: { messages } });
  await page.route("**/api/chat/compress", (r) => { attempts++; return r.fulfill({ status: 500, json: { error: "测试压缩失败" } }); });
  await page.route("**/api/chat", (r) => { sent++; return r.abort(); });
  await page.locator("#composerInput").fill("保留这条输入");
  await page.locator("#sendBtn").click();
  await expect(page.locator("#page-chat")).toContainText("测试压缩失败");
  await expect(page.locator("#composerInput")).toHaveValue("保留这条输入");
  expect(attempts).toBe(1); expect(sent).toBe(0);
});

test("升级默认重置与无密钥备份；模型编辑仅有额度", async ({ page }) => {
  await load(page, { legacy: true });
  await expect(page.locator("#cc-systemPrompt")).toHaveValue("");
  await page.locator('[data-section="data"]').click();
  await page.getByText("查看旧配置", { exact: true }).click();
  await expect(page.locator(".settings-backup")).toContainText("obsolete-provider-prompt");
  await expect(page.locator(".settings-backup")).not.toContainText('"apiKey"');
  await page.locator('[data-section="providers"]').click();
  await page.locator('[data-edit-provider="settings-provider"]').click();
  await page.locator('[data-model-row="model-a"] .provider-model-main').click();
  await expect(page.locator("#model-contextWindow")).toBeVisible();
  await expect(page.locator("#model-maxTokens")).toBeVisible();
  await expect(page.locator(".provider-model-advanced-toggle")).toHaveCount(0);
  await expect(page.locator("#pf-system")).toHaveCount(0);
});

test("设置搜索定位与所有分类无横向溢出", async ({ page }) => {
  await load(page);
  await page.getByLabel("搜索设置").fill("图片输入");
  await page.getByRole("button", { name: "模型兼容性 上下文与提示词" }).click();
  await expect(page.locator("#context-compatibility")).toBeFocused();
  await page.getByLabel("搜索设置").fill("");
  for (const key of ["appearance", "providers", "context", "tools", "skills", "data", "about"]) {
    await page.locator(`[data-section="${key}"]`).click();
    await expect(page.locator("#settingsContent .settings-pane").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
for (const [width, scheme] of [[1280, "light"], [1024, "dark"], [390, "light"]]) {
  test(`上下文设置视觉 ${width} ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await load(page, { scheme, hash: "#/settings/context/p", project: { systemPrompt: "专注于项目写作，先说明结论，再给出必要依据。" } });
    await expect(page.locator("#cc-systemPrompt")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`context-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#context-budget").scrollIntoViewIfNeeded();
    await expect(page.locator("#context-budget")).toHaveScreenshot(`context-budget-${width}-${scheme}.png`, { animations: "disabled", caret: "hide" });
  });
}

test("离开聊天后重新打开上下文页面，项目菜单与能力覆盖可用", async ({ page }) => {
  await load(page);
  await page.locator("#cc-visionInput").selectOption("false");
  await save(page);
  await page.evaluate(() => { location.hash = "#/chat"; });
  await expect(page.locator("#composerInput")).toBeVisible();
  await page.locator('[data-project-id="p"] [data-project-action="menu"]').click();
  await page.getByRole("menuitem", { name: "上下文与提示词" }).click();
  await expect(page.locator("#context-scope")).toHaveValue("p");
  await expect(page.locator("#cc-visionInput")).toHaveValue("false");
  await page.evaluate(() => { location.hash = "#/chat"; });
  await page.evaluate(() => { location.hash = "#/settings/context/p"; });
  await expect(page.locator("#cc-systemPrompt")).toBeVisible();
});

test("自动压缩关闭时超预算保留输入，工具栏思考强度可恢复继承", async ({ page }) => {
  let sent = 0;
  await load(page, { hash: "#/chat", config: { inputBudget: 50, defaultReasoningEffort: "high" } });
  await page.route("**/api/chat", (r) => { sent++; return r.abort(); });
  await page.locator("#composerInput").fill("超出预算".repeat(100));
  await page.locator("#sendBtn").click();
  await expect(page.locator("#page-chat")).toContainText("超过输入预算");
  await expect(page.locator("#composerInput")).not.toHaveValue(""); expect(sent).toBe(0);
  await page.locator("#runtimeBtn").click();
  await page.locator('[data-runtime-open="effort"]').click();
  await expect(page.locator("[data-effort-current]")).toHaveText("高");
  await page.locator(".effort-rail").focus(); await page.keyboard.press("Home");
  await expect(page.locator("[data-effort-source]")).toHaveText("当前会话自定义");
  await page.getByRole("button", { name: "恢复跟随配置" }).click();
  await expect(page.locator("[data-effort-current]")).toHaveText("高");
  await expect(page.locator("[data-effort-source]")).toHaveText("正在跟随配置");
});

test("低于阈值保留全部历史，不因轮数触发压缩", async ({ page }) => {
  let compressed = 0; let body;
  const messages = Array.from({ length: 10 }, (_, i) => [
    { id: `u${i}`, role: "user", content: `问题${i}` },
    { id: `a${i}`, role: "assistant", content: `回复${i}` }
  ]).flat();
  await load(page, { hash: "#/chat", config: { autoCompress: true }, conversation: { messages } });
  await page.route("**/api/chat/compress", (r) => { compressed++; return r.abort(); });
  await page.route("**/api/chat", (r) => { body = r.request().postDataJSON(); return r.fulfill({ json: { choices: [{ message: { role: "assistant", content: "完成" } }] } }); });
  await page.locator("#composerInput").fill("继续");
  await page.locator("#sendBtn").click();
  await expect.poll(() => body?.messages?.length).toBe(21);
  expect(compressed).toBe(0);
});
