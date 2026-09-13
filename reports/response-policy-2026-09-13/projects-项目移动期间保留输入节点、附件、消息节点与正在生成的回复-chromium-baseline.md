# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: projects.spec.js >> 项目移动期间保留输入节点、附件、消息节点与正在生成的回复
- Location: e2e/projects.spec.js:160:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('menuitem', { name: '移至项目', exact: true })
    - locator resolved to <button disabled type="button" role="menuitem" class="option-item" data-menu-action="move" title="首次响应尚未结束，请等待完成或停止生成后再修改对话。">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is not stable
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is not enabled
  55 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is not enabled
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - complementary "对话" [ref=e5]:
      - generic [ref=e6]:
        - heading "ai-chatbox" [level=2] [ref=e13]
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
          - generic [ref=e45]:
            - generic [ref=e46]:
              - generic [ref=e47]:
                - button "写作计划" [expanded] [ref=e48] [cursor=pointer]
                - button "写作计划：项目设置"
                - button "写作计划：新建聊天"
              - generic [ref=e56]:
                - button "聊天 a0 1天" [ref=e57] [cursor=pointer]:
                  - generic [ref=e58]: 聊天 a0
                  - generic [ref=e60]: 1天
                - button "聊天 a1 1天" [ref=e62] [cursor=pointer]:
                  - generic [ref=e63]: 聊天 a1
                  - generic [ref=e65]: 1天
                - button "聊天 a2 1天" [ref=e67] [cursor=pointer]:
                  - generic [ref=e68]: 聊天 a2
                  - generic [ref=e70]: 1天
                - button "聊天 a3 1天" [ref=e72] [cursor=pointer]:
                  - generic [ref=e73]: 聊天 a3
                  - generic [ref=e75]: 1天
                - button "聊天 a4 1天" [ref=e77] [cursor=pointer]:
                  - generic [ref=e78]: 聊天 a4
                  - generic [ref=e80]: 1天
                - button "展开显示" [ref=e82] [cursor=pointer]
            - generic [ref=e83]:
              - generic [ref=e84]:
                - button "产品设计" [expanded] [ref=e85] [cursor=pointer]
                - button "产品设计：项目设置"
                - button "产品设计：新建聊天"
              - generic [ref=e93]: 暂无聊天
        - region "聊天" [ref=e95]:
          - button "聊天" [expanded] [ref=e97] [cursor=pointer]
          - button "聊天 u 更多操作" [ref=e102] [cursor=pointer]:
            - generic [ref=e103]:
              - generic [ref=e104]: 聊天 u
              - generic "正在生成回复" [ref=e105]
            - button "更多操作" [active] [ref=e109]
      - navigation "应用导航" [ref=e114]:
        - button "设置" [ref=e115] [cursor=pointer]
    - main [ref=e120]:
      - generic [ref=e121]:
        - generic [ref=e123]:
          - generic [ref=e124]: Chat · 对话
          - generic [ref=e125]: 聊天 u
        - generic "本地服务正常" [ref=e128]
      - region "对话" [ref=e132]:
        - generic [ref=e134]:
          - generic [ref=e135]:
            - paragraph [ref=e138]: 测试移动时继续回答
            - generic [ref=e139]: 09:55
            - generic [ref=e140]:
              - button "复制" [ref=e141] [cursor=pointer]
              - button "编辑" [disabled] [ref=e145]
              - button "复制到新对话" [disabled] [ref=e149]
              - button "删除消息" [disabled] [ref=e155]
          - generic [ref=e158]:
            - generic [ref=e159]:
              - generic [ref=e164]: 测试供应商
              - generic [ref=e165]: demo-model
            - paragraph [ref=e169]: 第一段正在生成
            - generic [ref=e170]: 30s
            - generic [ref=e171]:
              - button "复制" [ref=e172] [cursor=pointer]
              - button "编辑" [disabled] [ref=e176]
              - button "复制到新对话" [disabled] [ref=e180]
              - button "重新生成" [disabled] [ref=e186]
              - button "删除消息" [disabled] [ref=e189]
        - generic [ref=e193]:
          - generic [ref=e194]:
            - generic [ref=e196]:
              - generic "stream-note.txt" [ref=e200]
              - button "移除" [ref=e201] [cursor=pointer]
            - textbox "输入消息，/ 打开指令" [ref=e205]: 下一条草稿
            - generic [ref=e206]:
              - button "添加附件" [ref=e207] [cursor=pointer]
              - generic [ref=e210]:
                - button "demo-model 中等" [disabled] [ref=e211]:
                  - generic [ref=e212]: demo-model
                  - generic [ref=e213]: 中等
                - button "压缩上下文（已用约 0%）" [ref=e217] [cursor=pointer]
                - button "停止生成" [ref=e222] [cursor=pointer]
          - generic [ref=e225]: Enter 发送 · Shift + Enter 换行
  - menu [ref=e227]:
    - menuitem "置顶" [disabled] [ref=e228] [cursor=pointer]
    - menuitem "重命名" [disabled] [ref=e234] [cursor=pointer]
    - menuitem "导出 .ai-chatbox.zip" [ref=e241] [cursor=pointer]
    - menuitem "移至项目" [disabled] [ref=e247] [cursor=pointer]
    - menuitem "删除对话" [disabled] [ref=e253] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const projects = [{ id: "a", name: "写作计划", createdAt: 1 }, { id: "b", name: "产品设计", createdAt: 2 }];
  4   | const chat = (id, projectId = null, updatedAt = 100) => ({ id, projectId, title: `聊天 ${id}`, createdAt: Date.now() - (1000 - updatedAt) * 60000, updatedAt: Date.now() - (1000 - updatedAt) * 60000, providerId: "project-provider", model: "demo-model", messages: [{ id: `${id}-m`, role: "user", content: `内容 ${id}`, createdAt: updatedAt }], draft: "" });
  5   | const seed = { projects, providers: [{ id: "project-provider", displayName: "测试供应商", defaultModel: "demo-model", models: ["demo-model"], baseUrl: "https://api.example.com/v1", enabled: true, saveChats: true, hasKeyConfigured: true }], activeProviderId: "project-provider", activeConversationId: "u", conversations: [chat("u"), ...Array.from({ length: 7 }, (_, i) => chat(`a${i}`, "a", 200 - i))] };
  6   | 
  7   | async function load(page, state = seed) {
  8   |   await page.addInitScript((value) => {
  9   |     if (!localStorage.getItem("project-test-seeded")) {
  10  |       localStorage.setItem("tribblebook-v6-state", JSON.stringify(value));
  11  |       localStorage.setItem("tribblebook-ui-preferences-v1", JSON.stringify({ appearanceMode: "light" }));
  12  |       localStorage.setItem("project-test-seeded", "true");
  13  |     }
  14  |   }, state);
  15  |   await page.route("**/api/health", route => route.fulfill({ json: { ok: true } }));
  16  |   await page.route("**/api/providers", route => route.fulfill({ json: { providers: [] } }));
  17  |   await page.goto("/");
  18  |   await expect(page.locator("#projectSelectorBtn")).toBeEnabled();
  19  | }
  20  | const project = (page, id) => page.locator(`[data-project-id="${id}"]`);
  21  | async function openProjectSelection(page) {
  22  |   if (await page.locator("#projectSelectorBtn").isVisible()) {
  23  |     await page.locator("#projectSelectorBtn").click();
  24  |   } else {
  25  |     const row = page.locator('.conversation-item.is-selected');
  26  |     await row.focus();
  27  |     await row.locator('[data-conv-action="menu"]').click();
> 28  |     await page.getByRole('menuitem', { name: '移至项目', exact: true }).click();
      |                                                                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
  29  |   }
  30  | }
  31  | async function selectProject(page, name) {
  32  |   await openProjectSelection(page);
  33  |   await page.getByRole("menuitemradio", { name, exact: true }).click();
  34  |   await expect(page.locator("#projectSelectorBtn")).toContainText(name);
  35  | }
  36  | async function saveName(page, name) {
  37  |   await page.locator(".dialog-input").fill(name);
  38  |   await page.getByRole("button", { name: "保存", exact: true }).click();
  39  |   await expect(page.locator(".dialog-card")).toHaveCount(0);
  40  | }
  41  | const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tribblebook-v6-state")));
  42  | 
  43  | test("项目分类：分区、五条限制、搜索与折叠恢复", async ({ page }) => {
  44  |   await load(page);
  45  |   await expect(page.locator(".filter-chip")).toHaveCount(0);
  46  |   await expect(page.locator('[data-section="chats"] .conversation-item')).toHaveCount(1);
  47  |   await expect(project(page, "a").locator(".conversation-item")).toHaveCount(5);
  48  |   await project(page, "a").getByRole("button", { name: "展开显示" }).click();
  49  |   await expect(project(page, "a").locator(".conversation-item")).toHaveCount(7);
  50  |   await project(page, "a").getByRole("button", { name: "收起显示" }).click();
  51  |   await project(page, "a").locator(".project-toggle").click();
  52  |   await expect(project(page, "a").locator(".conversation-item")).toHaveCount(0);
  53  |   await page.locator("#searchInput").fill("写作计划");
  54  |   await expect(project(page, "a").locator(".conversation-item")).toHaveCount(7);
  55  |   await page.locator("#searchInput").fill("");
  56  |   await expect(project(page, "a").locator(".conversation-item")).toHaveCount(0);
  57  |   await expect.poll(async () => (await saved(page)).projectSidebar?.collapsedProjectIds || []).toContain("a");
  58  |   await page.reload();
  59  |   await expect(project(page, "a").locator(".project-toggle")).toHaveAttribute("aria-expanded", "false");
  60  |   await page.locator("#searchInput").fill("a6");
  61  |   await page.locator('[data-conversation-id="a6"]').click();
  62  |   await page.locator("#searchInput").fill("");
  63  |   // Opening a result is an explicit navigation: keep it visible when search ends.
  64  |   await expect(project(page, "a").locator(".project-toggle")).toHaveAttribute("aria-expanded", "true");
  65  |   await expect(project(page, "a").locator('[data-conversation-id="a6"]')).toBeVisible();
  66  | });
  67  | 
  68  | test("项目管理：创建、移动、重命名、删除及刷新保留", async ({ page }) => {
  69  |   await load(page);
  70  |   await page.locator("#composerInput").fill("尚未发送的草稿");
  71  |   await selectProject(page, "产品设计");
  72  |   await expect(project(page, "b").locator('[data-conversation-id="u"]')).toBeVisible();
  73  |   await expect(page.locator("#composerInput")).toHaveValue("尚未发送的草稿");
  74  |   await expect(page.locator("#composerInput")).toBeFocused();
  75  |   await expect(page.locator("#messageList")).toContainText("内容 u");
  76  |   await project(page, "b").locator(".project-row").hover();
  77  |   await project(page, "b").locator('[data-project-action="menu"]').click();
  78  |   await expect(page.getByRole("dialog", { name: "项目设置", exact: true })).toBeVisible();
  79  |   await page.getByLabel("项目名称", { exact: true }).fill("产品设计新版");
  80  |   await page.getByRole("button", { name: "保存名称", exact: true }).click();
  81  |   await expect(page.getByRole("status").filter({ hasText: "项目名称已保存" })).toBeVisible();
  82  |   await page.getByRole("button", { name: "关闭项目设置", exact: true }).click();
  83  |   await expect(page.locator("#projectSelectorBtn")).toContainText("产品设计新版");
  84  |   await expect(page.locator("#projectSelectorBtn")).toBeHidden();
  85  |   await openProjectSelection(page);
  86  |   await page.getByRole("menuitem", { name: "新建项目", exact: true }).click();
  87  |   await saveName(page, "选择器新项目");
  88  |   await expect(page.locator("#projectSelectorBtn")).toContainText("选择器新项目");
  89  |   await expect(page.locator("#messageList")).toContainText("内容 u");
  90  |   const currentProject = page.locator('.sidebar-project').filter({ has: page.locator('.project-toggle', { hasText: "选择器新项目" }) });
  91  |   await currentProject.locator(".project-row").hover();
  92  |   await currentProject.locator('[data-project-action="menu"]').click();
  93  |   await page.getByRole("button", { name: "删除项目", exact: true }).click();
  94  |   await expect(page.locator(".dialog-message")).toContainText("全部聊天会保留");
  95  |   await page.locator('.dialog-card [data-role="confirm"]').click();
  96  |   await expect(page.locator("#projectSelectorBtn")).toContainText("无项目");
  97  |   await expect(page.locator('[data-section="chats"] [data-conversation-id="u"]')).toBeVisible();
  98  |   await page.getByRole("button", { name: "新建项目", exact: true }).click();
  99  |   await saveName(page, "侧栏新项目");
  100 |   await expect(page.locator("#projectSelectorBtn")).toContainText("侧栏新项目");
  101 |   await expect(page.locator("#composerInput")).toHaveValue("");
  102 |   await expect(page.locator(".empty-stage")).toBeVisible();
  103 |   await expect.poll(async () => (await saved(page)).projects.map(p => p.name)).toEqual(["写作计划", "产品设计新版", "侧栏新项目"]);
  104 |   await page.reload();
  105 |   await expect(page.locator("#projectSelectorBtn")).toContainText("侧栏新项目");
  106 | });
  107 | 
  108 | test("新建继承当前项目、显式跨项目及无项目；草稿和附件留在原聊天", async ({ page }) => {
  109 |   await load(page);
  110 |   await page.locator('[data-conversation-id="a3"]').click();
  111 |   await page.locator("#newConversationBtn").click();
  112 |   await expect(page.locator("#projectSelectorBtn")).toContainText("写作计划");
  113 |   await expect(page.locator('.conversation-item.is-selected')).toHaveCount(0);
  114 |   await page.locator("#newConversationBtn").click();
  115 |   await expect(page.locator('.conversation-item.is-selected')).toHaveCount(0);
  116 |   await page.locator("#composerInput").fill("项目 A 草稿");
  117 |   await page.locator("#attachmentInput").setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("待发送附件") });
  118 |   await expect(page.locator("#composerChips")).toContainText("note.txt");
  119 |   await project(page, "b").locator(".project-row").hover();
  120 |   await project(page, "b").locator('[data-project-action="new-chat"]').click();
  121 |   await expect(page.locator("#projectSelectorBtn")).toContainText("产品设计");
  122 |   await expect(page.locator("#composerInput")).toHaveValue("");
  123 |   await expect(page.locator("#composerChips")).toBeHidden();
  124 |   await project(page, "a").locator(".project-row").hover();
  125 |   await project(page, "a").locator('[data-project-action="new-chat"]').click();
  126 |   await expect(page.locator("#composerInput")).toHaveValue("项目 A 草稿");
  127 |   await expect(page.locator("#composerChips")).toContainText("note.txt");
  128 |   await selectProject(page, "无项目");
```