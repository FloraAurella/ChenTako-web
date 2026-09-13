import { Button, Disclosure } from "../../../shared/ui/primitives";
import { SettingsCard, SettingsGroup } from "../../../shared/ui/SettingsCard";
import { useEffect } from "react";
import { APP_SETTINGS_VERSION, CURRENT_RELEASE, RELEASE_NOTES } from "../../../shared/settings/settings-view-model";
import { TrustedIcon } from "../../../shared/ui/Icon";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { SettingsState } from "../../../contracts/settings";

function BackendStatus({ backend }: { backend: any }) {
  const value = backend.status === "ok"
    ? "本地服务正常"
    : backend.status === "checking"
      ? "正在检查本地服务…"
      : `本地服务不可达${backend.message ? `：${backend.message}` : ""}`;
  return <div className={`backend-status backend-${backend.status}`}>{value}</div>;
}

export function DataPane({ store, state, service }: { store: ExternalStore & { state: any }; state: SettingsState; service: SettingsService }) {

  useEffect(() => {
    if (!state.migrationStatus) void service.data.refreshMigrationStatus();
  }, [service, state.migrationStatus]);

  const status = state.migrationStatus;
  const available = Boolean(status?.available);
  const result = status?.lastResult;
  const resultPath = result?.outputPath || result?.backupPath || result?.dataPath || "";
  const description = !status
    ? "检查中…"
    : available
      ? "导出本机数据。"
      : status.reason;

  return (
    <div className="settings-pane">
      <h2 className="settings-pane-title">数据管理</h2>


      <SettingsGroup id="data-common" title="常用配置">
        <div id="data-migration" tabIndex={-1} className="paper-panel settings-card migration-card" data-migration-mode="export">
        <div className="migration-card-head">
          <div>
            <h3 className="settings-card-title">迁移</h3>

          </div>
          <span className={`migration-status-badge ${available ? "is-ready" : ""}`}>
            {!status ? "检查中" : available ? "可以迁移" : "不可用"}
          </span>
        </div>
        <div className="migration-route" aria-label="从本机目录导出迁移包">
          <span className="migration-route-node is-active"><TrustedIcon name="database" size={13} /> 本机数据</span>
          <span className="migration-route-arrow" aria-hidden="true">→</span>
          <span className="migration-route-node"><TrustedIcon name="archive" size={13} /> 加密包 + key.md</span>
        </div>
        <p className="settings-card-desc migration-description">{description || "当前无法使用数据迁移。"}</p>
        {status?.dataLocation ? (
          <div className="migration-location"><span>当前数据位置</span><code className="migration-path">{status.dataLocation}</code></div>
        ) : null}
        {status?.themeArchivePath ? (
          <div className="migration-location"><span>主题包位置</span><code className="migration-path">{status.themeArchivePath}</code></div>
        ) : null}
        {available ? (
          <div className="migration-secret-note"><TrustedIcon name="shield" size={14} /> 迁移包含密钥，请妥善保管。</div>
        ) : null}
        <div className="migration-actions">
          <Button type="button" className="btn btn-primary" id="migrationCreateBtn" disabled={!available || state.migrationBusy} onClick={() => void service.data.createMigrationPackage()}>
            <TrustedIcon name="archive" size={15} /> {state.migrationBusy ? "正在封装迁移数据…" : "迁移…"}
          </Button>
        </div>
        {result ? (
          <div className={`migration-result ${result.status === "success" ? "is-success" : "is-error"}`} role="status">
            <div className="migration-result-title">
              <TrustedIcon name={result.status === "success" ? "check" : "alert"} size={14} /> {result.message || (result.status === "success" ? "迁移操作已完成" : "迁移操作失败")}
            </div>
            {resultPath ? <code className="migration-path">{resultPath}</code> : null}
            {resultPath && result.status === "success" ? (
              <Button type="button" className="btn btn-ghost migration-reveal-btn" id="migrationRevealBtn" onClick={() => void service.data.revealMigrationResult()}>在访达中显示</Button>
            ) : null}
          </div>
        ) : null}
      </div>

        <div id="data-import" tabIndex={-1} className="paper-panel settings-card">
          <h3 className="settings-card-title">导入对话</h3>
          <p className="settings-card-desc">导入 JSON 或 <code className="inline-code">.ai-chatbox.zip</code> 对话文件（最大 130MB）。</p>
          <Button type="button" className="btn btn-primary" id="dataImportBtn" onClick={() => void service.data.importConversation()}>
            <TrustedIcon name="upload" size={15} /> 选择文件导入
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup id="data-advanced" title="高级配置">
        <details className="settings-legacy-details"><summary>旧配置备份</summary>
        <SettingsCard id="legacy-settings" title="旧配置备份" description="仅供查阅，不自动生效；不含 API Key。">
          {store.state.legacySettingsBackup ? <><pre className="settings-backup">{JSON.stringify(store.state.legacySettingsBackup, null, 2)}</pre><Button type="button" className="btn btn-secondary" onClick={() => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(store.state.legacySettingsBackup, null, 2)], { type: "application/json" }));
            const a = document.createElement("a"); a.href = url; a.download = "ai-chatbox-legacy-settings.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>导出旧配置</Button></> : <p className="field-help">暂无旧配置。</p>}
        </SettingsCard>
        </details>
      </SettingsGroup>
    </div>
  );
}

function ReleaseChanges({ changes }: { changes: Array<{ tag: string; text: string }> }) {
  return (
    <ul className="release-list">
      {changes.map((change, index) => (
        <li key={index}><span className="tag">{change.tag}</span>{change.text}</li>
      ))}
    </ul>
  );
}

export function ChangelogPane() {
  return (
    <div className="settings-pane">
      <h2 className="settings-pane-title">更新日志</h2>

      <div className="paper-panel settings-card release-card is-current">
        <div className="release-head">
          <span className="release-version">v{CURRENT_RELEASE.displayVersion}</span>
          <span className="release-current-flag">{CURRENT_RELEASE.isPatch ? "当前版本 · 补丁包" : "当前版本"}</span>
          <span className="release-date">{CURRENT_RELEASE.date}</span>
        </div>
        <div className="release-title">{CURRENT_RELEASE.title}</div>
        <p className="settings-card-desc">{CURRENT_RELEASE.summary}</p>
        <ReleaseChanges changes={CURRENT_RELEASE.changes} />
      </div>
      {RELEASE_NOTES.map((note: any) => (
        <div className="paper-panel settings-card release-card" key={`${note.displayVersion || note.version}-${note.date}`}>
          <div className="release-head">
            <span className="release-version">v{note.displayVersion || note.version}</span>
            <span className="release-date">{note.date}</span>
          </div>
          <div className="release-title">{note.title}</div>
          <p className="settings-card-desc">{note.summary}</p>
          <ReleaseChanges changes={note.changes} />
        </div>
      ))}
    </div>
  );
}

export function AboutPane({ store, service }: { store: ExternalStore; service: SettingsService }) {
  const backend = useStoreValue<any>(store, "backend");
  return <div className="settings-pane about-pane"><h2 className="settings-pane-title">关于与更新</h2>
      <div id="about-runtime" tabIndex={-1} className="paper-panel settings-card">
        <h3 className="settings-card-title">版本与运行环境</h3>
        <dl className="usage-stats">
          <div className="usage-stat"><dt>版本</dt><dd>v{APP_SETTINGS_VERSION}{CURRENT_RELEASE.isPatch ? "（补丁包）" : ""}</dd></div>
          <div className="usage-stat"><dt>运行环境</dt><dd>{(window["ai-chatbox"] ?? window.clawbox) ? "Electron 桌面" : "浏览器"}</dd></div>
          <div className="usage-stat"><dt>存储策略</dt><dd>数据保存在本机</dd></div>
          <div className="usage-stat"><dt>API Key</dt><dd>本机存储，加密备份</dd></div>
        </dl>
        <div style={{ marginTop: 14 }}><BackendStatus backend={backend} /></div>
        <Button type="button" className="btn btn-secondary" id="healthCheckBtn" style={{ marginTop: 12 }} onClick={() => void service.data.checkHealth()}>
          <TrustedIcon name="refresh" size={14} /> 检查本地服务
        </Button>
      </div>

<Disclosure label="更新日志"><ChangelogPane /></Disclosure></div>;
}
