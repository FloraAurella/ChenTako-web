"use strict";

import { exportConversationArchive, importConversationArchive } from "../../data/public/domain_archive.js";
import { sortConversations } from "../domain/queries.js";
import { icon } from "../../../resources/icons/index.js";
import { downloadBlob, truncateText } from "../../../shared/utils.js";
import { createProjectActions } from "../../projects/public/services_project-actions.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Owns conversation-list commands and archive import/export. It deliberately
 * receives UI primitives as dependencies so the Store remains framework-agnostic.
 */
export function createConversationActions({
  store,
  shell,
  dialogs,
  toast,
  activeConversation,
  focusComposer,
  closeDrawerIfOverlay = () => {},
  stopStreamForConversation,
  openPopover
}) {
  const state = () => store.state;
  const projects = createProjectActions({ store, dialogs, toast, openPopover, createNewConversation, focusComposer });

  function bindSidebarEvents() {
    shell.searchInput.addEventListener("input", () => {
      store.actions.setSidebar({ query: shell.searchInput.value });
    });
    shell.archiveDrawer.addEventListener("click", (event) => {
      const projectAction = event.target.closest("[data-project-action]");
      if (projectAction) {
        const id = projectAction.closest("[data-project-id]")?.dataset.projectId;
        if (projectAction.dataset.projectAction === "create") void projects.createProject();
        if (projectAction.dataset.projectAction === "menu") projects.openProjectMenu(projectAction, id);
        if (projectAction.dataset.projectAction === "new-chat") createNewConversation({ projectId: id });
        return;
      }
      const item = event.target.closest(".conversation-item");
      if (!item) return;
      const action = event.target.closest("[data-conv-action]");
      const id = item.dataset.conversationId;
      if (action) {
        event.stopPropagation();
        if (action.dataset.convAction === "menu") {
          item.classList.add("menu-open");
          const controller = openConversationMenu(action, id);
          if (controller) {
            const originalClose = controller.close.bind(controller);
            controller.close = () => {
              item.classList.remove("menu-open");
              originalClose();
            };
          }
        }
        return;
      }
      state().activeConversationId = id;
      store.persistSoon();
      store.notify("conversation-selected");
      closeDrawerIfOverlay();
    });
    shell.archiveDrawer.addEventListener("keydown", (event) => {
      if (event.target.matches(".conversation-item") && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.target.click();
      }
    });
    document.getElementById("newConversationBtn").addEventListener("click", () => createNewConversation());
    document.getElementById("projectSelectorBtn").addEventListener("click", (event) => projects.openProjectPicker(event.currentTarget, state().activeConversationId, { placement: "top" }));
    document.getElementById("importConversationBtn").addEventListener("click", importFromFileDialog);
  }

  function createNewConversation({ projectId = activeConversation()?.projectId ?? null } = {}) {
    if (state().sidebar.query) {
      shell.searchInput.value = "";
      store.actions.setSidebar({ query: "" });
    }
    const current = activeConversation();
    if (current && current.messages.length === 0 && !String(current.draft || "").trim() && !state().pendingAttachments.length && (current.projectId ?? null) === projectId) {
      store.revealConversation(current.id);
      focusComposer();
      closeDrawerIfOverlay();
      return;
    }
    store.createConversation({ projectId });
    focusComposer();
    closeDrawerIfOverlay();
  }

  function handleShortcutNewConversation() {
    createNewConversation();
  }

  function openConversationMenu(anchor, id) {
    const conversation = state().conversations.find((item) => item.id === id);
    if (!conversation) return null;
    const run = {
      pin: () => togglePin(id),
      rename: () => renameConversation(id),
      export: () => exportConversation(id),
      move: () => projects.openProjectPicker(anchor, id),
      delete: () => deleteConversation(id)
    };
    const items = [
      { action: "pin", icon: "pin", label: conversation.pinned ? "取消置顶" : "置顶" },
      { action: "rename", icon: "edit", label: "重命名" },
      { action: "export", icon: "download", label: "导出 .clawbox.zip" },
      { action: "move", icon: "folder", label: "移至项目" },
      { action: "delete", icon: "trash", label: "删除对话", danger: true }
    ];
    return openPopover({
      anchor,
      kind: "menu",
      cardClass: "menu-popover",
      html: [
        `<div class="popover-scroll" role="menu">`,
        items.slice(0, -1).map(menuItemHtml).join(""),
        `<div class="menu-divider"></div>`,
        menuItemHtml(items[items.length - 1]),
        `</div>`
      ].join(""),
      bind(card, controller) {
        card.querySelectorAll("[data-menu-action]").forEach((button) => {
          button.addEventListener("click", () => {
            const action = button.dataset.menuAction;
            controller.close();
            if (run[action]) run[action]();
          });
        });
      }
    });
  }

  function menuItemHtml(item) {
    return [
      `<button type="button" class="option-item${item.danger ? " danger" : ""}" role="menuitem" data-menu-action="${item.action}">`,
      `<span class="menu-icon">${icon(item.icon, 15)}</span>`,
      `<div class="option-main"><div class="option-title">${escapeHtml(item.label)}</div></div>`,
      `</button>`
    ].join("");
  }

  async function renameConversation(id) {
    const conversation = state().conversations.find((item) => item.id === id);
    if (!conversation) return;
    const title = await dialogs.prompt({
      title: "重命名对话",
      value: conversation.title,
      placeholder: "给这段对话起个名字",
      confirmLabel: "保存"
    });
    if (title === null) return;
    conversation.title = truncateText(title, 60) || "未命名对话";
    store.touchConversation(conversation);
    store.notify("conversation-renamed");
  }

  function togglePin(id) {
    const conversation = state().conversations.find((item) => item.id === id);
    if (!conversation) return;
    conversation.pinned = !conversation.pinned;
    state().conversations = sortConversations(state().conversations);
    store.persistSoon();
    store.notify("conversation-updated");
  }

  async function deleteConversation(id) {
    const conversation = state().conversations.find((item) => item.id === id);
    if (!conversation) return;
    const ok = await dialogs.confirm({
      title: "删除对话",
      message: `「${conversation.title || "未命名对话"}」连同全部消息将从此设备移除，无法恢复。`,
      confirmLabel: "删除",
      danger: true
    });
    if (!ok) return;
    stopStreamForConversation(id);
    state().pendingAttachmentsByConversation.delete(id);
    state().conversations = state().conversations.filter((item) => item.id !== id);
    if (!state().conversations.length) {
      store.createConversation({ silent: true });
    } else if (state().activeConversationId === id) {
      state().activeConversationId = state().conversations[0].id;
    }
    store.persistSoon();
    store.notify("conversation-selected");
    toast("对话已删除");
  }

  function exportConversation(id) {
    const conversation = state().conversations.find((item) => item.id === id);
    if (!conversation) return;
    try {
      const { bytes, filename } = exportConversationArchive(conversation);
      downloadBlob(new Blob([bytes], { type: "application/zip" }), filename);
      toast("已导出 .clawbox.zip", { tone: "ok" });
    } catch (error) {
      toast(`导出失败：${error.message}`, { tone: "danger" });
    }
  }

  function importFromFileDialog() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.zip,application/json,application/zip";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const conversation = await importConversationArchive(file, state().providers);
        if (state().conversations.some((item) => item.id === conversation.id)) {
          conversation.id = `${conversation.id}-${Date.now().toString(36)}`;
        }
        state().conversations = sortConversations([conversation, ...state().conversations]);
        state().activeConversationId = conversation.id;
        store.persistSoon();
        store.notify("conversation-selected");
        toast(`已导入「${conversation.title}」`, { tone: "ok" });
      } catch (error) {
        toast(`导入失败：${error.message}`, { tone: "danger" });
      }
    });
    input.click();
  }

  return {
    bindSidebarEvents,
    createNewConversation,
    handleShortcutNewConversation,
    renameConversation,
    exportConversation
  };
}
