import { Button, TextField } from "../../../shared/ui/primitives";
import { ThemeCard } from "./ThemeCard";
import { listThemes } from "../domain/registry.js";
import { readSurfaceAppearance } from "../surface.js";
import { APPEARANCE_CONTRAST_MAX, APPEARANCE_CONTRAST_MIN } from "../../../shared/settings/settings-view-model";
import { TrustedIcon } from "../../../shared/ui/Icon";
import type { SettingsService } from "../../settings/public/services_settings-service";
import type { SettingsState } from "../../../contracts/settings";

function ContrastControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const fill = ((value - APPEARANCE_CONTRAST_MIN) / (APPEARANCE_CONTRAST_MAX - APPEARANCE_CONTRAST_MIN)) * 100;
  return <div className="bg-effect-control">
    <div className="bg-effect-head"><label htmlFor="appearanceContrastRange">对比度</label><output id="appearanceContrastValue" htmlFor="appearanceContrastRange">{value}</output></div>
    <p className="bg-effect-hint" id="appearanceContrastHint">调整背景与卡片之间的明暗差异。</p>
    <TextField
      type="range"
      id="appearanceContrastRange"
      className="bg-effect-range"
      min={APPEARANCE_CONTRAST_MIN}
      max={APPEARANCE_CONTRAST_MAX}
      step="1"
      value={value}
      aria-describedby="appearanceContrastHint"
      style={{ "--range-fill": `${fill}%` } as any}
      onInput={(event) => onChange(Number(event.currentTarget.value))}
    />
    <div className="bg-effect-scale"><span>柔和</span><span>鲜明</span></div>
  </div>;
}

export function AppearancePane({ service, state }: { service: SettingsService; state: SettingsState }) {
  const theme = service.theme;
  const current = theme.current();
  const activeTheme = listThemes().find((entry: any) => entry.id === current.themeId);
  const themeLabel = activeTheme?.label || current.themeId;
  const scheme = current.scheme === "dark" ? "dark" : "light";
  const persisted = readSurfaceAppearance(current.themeId, scheme);
  const activeOverride = state.appearanceOverride;
  const override = activeOverride && activeOverride.themeId === current.themeId && activeOverride.scheme === scheme
    ? activeOverride
    : null;
  const appearance = { ...persisted, ...override };
  const mode = current.appearanceMode || "system";

  return <div className="settings-pane appearance-pane">
    <h2 className="settings-pane-title">外观</h2>
    <p className="settings-pane-lede">选择喜欢的配色，让工作空间更适合你。</p>

    <div className="paper-panel settings-card appearance-mode-row">
      <div><h3 id="appearance-mode" tabIndex={-1} className="settings-card-title">明暗模式</h3>
      <p className="settings-card-desc">选择浅色、深色或跟随系统{mode === "system" ? `（当前${scheme === "dark" ? "深色" : "浅色"}）` : ""}。</p></div>
      <div className="appearance-mode-selector">
        {([["system", "monitor", "跟随系统"], ["light", "sun", "浅色"], ["dark", "moon", "深色"]] as const).map(([value, icon, label]) => <label key={value} className={`appearance-mode-option${mode === value ? " active" : ""}`}><TextField type="radio" name="appearanceMode" value={value} checked={mode === value} onChange={() => service.appearance.setAppearanceMode(value)} /><span className="appearance-mode-label"><TrustedIcon name={icon} size={16} /> {label}</span></label>)}
      </div>
    </div>

    <section className="appearance-themes" aria-labelledby="appearance-themes">
      <header className="appearance-section-head">
        <div><h3 id="appearance-themes" tabIndex={-1} className="settings-card-title">主题</h3><p className="settings-card-desc">界面配色与思考强度，一览可见。</p></div>
        <div className="theme-package-actions">
          <Button type="button" className="btn btn-secondary" id="themePackageImportBtn" disabled={state.themePackageBusy} onClick={() => void service.appearance.chooseThemeJson()}><TrustedIcon name="upload" size={15} /> 导入主题</Button>
          <Button type="button" className="btn btn-ghost" id="themePackageExportBtn" disabled={state.themePackageBusy} onClick={() => void service.appearance.exportThemeJson()}><TrustedIcon name="download" size={15} /> 导出</Button>
        </div>
      </header>
      <div className="theme-grid" id="themeGrid">{listThemes().map((entry: any) => <ThemeCard key={entry.id} entry={entry} activeId={current.themeId} scheme={scheme} service={service} />)}</div>
    </section>

    <div className="paper-panel settings-card">
      <h3 id="appearance-background" tabIndex={-1} className="settings-card-title">界面层次</h3>
      <p className="settings-card-desc">当前使用「{themeLabel}」{scheme === "dark" ? "深色" : "浅色"}配色，调整即时生效。</p>
      <div className="bg-effect-stack">
        <ContrastControl value={appearance.contrast} onChange={service.appearance.setContrast} />
        <div className="bg-effect-divider" aria-hidden="true" />
        <div className="toggle-zone">
          <div><div className="toggle-label">透景模式</div><div className="toggle-hint">让卡片与对话框呈现柔和的毛玻璃效果。</div></div>
          <Button type="button" className="toggle" role="switch" id="appearanceTransparentToggle" aria-label="开启透景模式" aria-checked={appearance.transparent} onClick={() => service.appearance.setTransparent(!appearance.transparent)} />
        </div>
      </div>
    </div>
  </div>;
}
