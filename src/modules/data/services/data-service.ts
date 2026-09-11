import { apiFetch } from "../../../shared/api.js";
import { importConversationArchive } from "../domain/archive.js";
import { LIMITS } from "../../../contracts/constants.js";
import { sortConversations } from "../../chat/public/domain_queries.js";
import { getMigrationBridge, type MigrationStatus, type SettingsDependencies, type SettingsStateBridge } from "../../../contracts/settings";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function chooseArchive(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.zip";
    input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });
}

export function createDataSettingsService(
  dependencies: SettingsDependencies,
  stateBridge: SettingsStateBridge
) {
  const { store, dialogs, toast } = dependencies;

  async function refreshMigrationStatus(): Promise<void> {
    const bridge = getMigrationBridge();
    if (!bridge || stateBridge.get().migrationLoading) return;
    stateBridge.patch({ migrationLoading: true });
    try {
      const status = await bridge.getStatus();
      stateBridge.patch({ migrationStatus: status, migrationLoading: false });
    } catch (error) {
      const migrationStatus: MigrationStatus = {
        available: false,
        reason: `无法读取迁移状态：${errorMessage(error)}`,
        dataLocation: "",
        themeArchivePath: "",
        encryption: "",
        keyBits: 0,
        lastResult: null
      };
      stateBridge.patch({ migrationStatus, migrationLoading: false });
    }
  }

  async function checkHealth(): Promise<void> {
    store.setBackendStatus("checking");
    try {
      const response = await apiFetch("/api/health");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json().catch(() => null);
      if (!payload?.ok) throw new Error("健康检查响应异常");
      store.setBackendStatus("ok");
      toast("本地服务正常", { tone: "ok" });
    } catch (error) {
      const detail = errorMessage(error);
      store.setBackendStatus("down", detail);
      toast(`本地服务不可达：${detail}`, { tone: "danger" });
    }
  }

  async function createMigrationPackage(): Promise<void> {
    const bridge = getMigrationBridge();
    const status = stateBridge.get().migrationStatus;
    if (!bridge || !status?.available || stateBridge.get().migrationBusy) return;
    const confirmed = await dialogs.confirm({
      title: "导出完整迁移包",
      message: "Clawbox 会先让对话与本地服务数据全部落盘，然后重启一次完成压缩与 AES-128-GCM 加密。外层 ZIP 同时包含解密所需的 key.md，请把整个文件视为敏感数据。",
      confirmLabel: "导出并重启"
    });
    if (!confirmed) return;
    stateBridge.patch({ migrationBusy: true });
    try {
      if (!(await store.persist())) throw new Error("本地配置尚未可靠保存，请释放磁盘空间后重试迁移。");
      const result = await bridge.createPackage();
      if (result?.cancelled) {
        stateBridge.patch({ migrationBusy: false });
        toast("已取消迁移");
      } else {
        toast("数据已落盘，Clawbox 正在重启并导出迁移包", { tone: "ok" });
      }
    } catch (error) {
      stateBridge.patch({ migrationBusy: false });
      toast(`迁移包创建失败：${errorMessage(error)}`, { tone: "danger" });
      await refreshMigrationStatus();
    }
  }

  async function revealMigrationResult(): Promise<void> {
    try {
      const revealed = await getMigrationBridge()?.revealLastResult();
      if (!revealed) toast("迁移文件已被移动或删除", { tone: "danger" });
    } catch (error) {
      toast(`无法在访达中显示：${errorMessage(error)}`, { tone: "danger" });
    }
  }

  async function importConversation(): Promise<void> {
    const file = await chooseArchive();
    if (!file) return;
    if (file.size > LIMITS.importBytes) {
      toast(`导入文件不能超过 ${Math.floor(LIMITS.importBytes / 1024 / 1024)}MB`, { tone: "danger" });
      return;
    }
    try {
      const conversation: any = await importConversationArchive(file, store.state.providers);
      if (store.state.conversations.some((item: any) => item.id === conversation.id)) {
        conversation.id = `${conversation.id}-${Date.now().toString(36)}`;
      }
      store.state.conversations = sortConversations([conversation, ...store.state.conversations]);
      store.state.activeConversationId = conversation.id;
      store.persistSoon();
      store.notify("conversation-imported", ["conversation-list", `conversation:${conversation.id}`]);
      toast(`已导入「${conversation.title}」`, { tone: "ok" });
      location.hash = "#/chat";
    } catch (error) {
      toast(`导入失败：${errorMessage(error)}`, { tone: "danger" });
    }
  }

  return {
    refreshMigrationStatus,
    checkHealth,
    createMigrationPackage,
    revealMigrationResult,
    importConversation
  };
}
