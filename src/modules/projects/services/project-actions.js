import { icon } from "../../../resources/icons/index.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function bindMenuKeyboard(card, anchor) {
  anchor.setAttribute("aria-expanded", "true");
  const buttons = [...card.querySelectorAll("button")];
  (card.querySelector('[aria-checked="true"]') || buttons[0])?.focus();
  card.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  });
}

export function createProjectActions({ store, dialogs, toast, openPopover, createNewConversation, focusComposer }) {
  async function askName(title, value = "") {
    let name = value;
    let message = "";
    while (true) {
      const result = await dialogs.prompt({ title, message, value: name, placeholder: "项目名称（最多 60 个字符）", confirmLabel: "保存" });
      if (result === null) return null;
      name = result.trim();
      if (name && name.length <= 60) return name;
      message = name ? "项目名称不能超过 60 个字符" : "项目名称不能为空";
    }
  }

  async function createProject(conversationId = null) {
    const name = await askName("新建项目");
    if (name === null) return;
    const project = store.createProject(name);
    store.actions.setSidebar({
      collapsedSections: store.state.sidebar.collapsedSections.filter((key) => key !== "projects")
    });
    if (conversationId) {
      store.moveConversationToProject(conversationId, project.id);
      focusComposer();
    } else createNewConversation({ projectId: project.id });
  }

  function openProjectPicker(anchor, conversationId, { placement } = {}) {
    const conversation = store.state.conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    const options = [{ id: null, name: "无项目" }, ...store.state.projects];
    return openPopover({
      anchor, kind: "menu", cardClass: "menu-popover runtime-popover model-popover project-picker",
      placement,
      html: `<div class="popover-scroll" role="menu" aria-label="选择项目">${options.map((project, index) =>
        `<button type="button" class="option-item" role="menuitemradio" aria-checked="${conversation.projectId === project.id}" data-project-index="${index}"><span class="menu-icon">${icon("folder", 16)}</span><span class="option-main"><span class="option-title">${escapeHtml(project.name)}</span></span>${conversation.projectId === project.id ? icon("check", 15) : ""}</button>`
      ).join("")}<div class="menu-divider"></div><button type="button" class="option-item" role="menuitem" data-create-project>${icon("plus", 16)}<span>新建项目</span></button></div>`,
      bind(card, controller) {
        bindMenuKeyboard(card, anchor);
        card.querySelectorAll("[data-project-index]").forEach((button) => button.addEventListener("click", () => {
          const project = options[Number(button.dataset.projectIndex)];
          controller.close();
          store.moveConversationToProject(conversationId, project.id);
          if (conversationId === store.state.activeConversationId) focusComposer();
        }));
        card.querySelector("[data-create-project]").addEventListener("click", () => {
          controller.close();
          void createProject(conversationId);
        });
      }
    });
  }

  function openProjectMenu(anchor, id) {
    const project = store.state.projects.find((item) => item.id === id);
    if (!project) return;
    return openPopover({
      anchor, kind: "menu", cardClass: "menu-popover runtime-popover model-popover",
      html: `<div class="popover-scroll" role="menu"><button type="button" class="option-item" role="menuitem" data-project-context>${icon("settings", 16)}<span>上下文与提示词</span></button><button type="button" class="option-item" role="menuitem" data-project-rename>${icon("edit", 16)}<span>重命名项目</span></button><div class="menu-divider"></div><button type="button" class="option-item danger" role="menuitem" data-project-delete>${icon("trash", 16)}<span>删除项目</span></button></div>`,
      bind(card, controller) {
        bindMenuKeyboard(card, anchor);
        card.querySelector("[data-project-context]").addEventListener("click", () => { controller.close(); location.hash = `#/settings/context/${encodeURIComponent(id)}`; });
        card.querySelector("[data-project-rename]").addEventListener("click", async () => {
          controller.close();
          const name = await askName("重命名项目", project.name);
          if (name !== null) store.renameProject(id, name);
        });
        card.querySelector("[data-project-delete]").addEventListener("click", async () => {
          controller.close();
          const confirmed = await dialogs.confirm({ title: "删除项目", message: `删除「${project.name}」后，其中的全部聊天会保留并移到“无项目”。`, confirmLabel: "删除项目", danger: true });
          if (confirmed) store.deleteProject(id);
        });
      }
    });
  }

  return { createProject, openProjectPicker, openProjectMenu };
}
