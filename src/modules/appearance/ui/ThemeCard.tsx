import { Button } from "../../../shared/ui/primitives";
import type { CSSProperties } from "react";
import { LIGHT_TOKENS, DARK_TOKENS } from "../domain/base-themes.js";
import { TrustedIcon } from "../../../shared/ui/Icon";
import type { SettingsService } from "../../settings/public/services_settings-service";

type Scheme = "light" | "dark";
interface ThemeEntry {
  id: string;
  label: string;
  note?: string;
  fixedScheme?: string;
  removable?: boolean;
  user?: boolean;
  tokens?: Partial<Record<Scheme, Record<string, string>>>;
}

// Match the runtime: incomplete palettes fall back to the same scheme's baseline.
export function themeCardTokens(entry: ThemeEntry, scheme: Scheme) {
  const resolvedScheme = entry.fixedScheme === "light" || entry.fixedScheme === "dark" ? entry.fixedScheme : scheme;
  return { ...(resolvedScheme === "dark" ? DARK_TOKENS : LIGHT_TOKENS), ...entry.tokens?.[resolvedScheme] } as Record<string, string>;
}

export function ThemeCard({ entry, activeId, scheme, service }: {
  entry: ThemeEntry; activeId: string; scheme: Scheme; service: SettingsService;
}) {
  const tokens = themeCardTokens(entry, scheme);
  const active = entry.id === activeId;
  const colors = [
    ["画布", "--canvas-mid"], ["纸面", "--surface-content"],
    ["强调色", "--accent"], ["文字", "--label"]
  ];
  const style = {
    "--preview-canvas": tokens["--canvas-mid"], "--preview-paper": tokens["--surface-content"],
    "--preview-ink": tokens["--label"], "--preview-accent": tokens["--accent"],
    "--preview-bubble": tokens["--user-bubble-bg"], "--preview-line": tokens["--separator"],
    "--preview-effort": tokens["--effort-accent"], "--preview-effort-2": tokens["--effort-accent-2"],
    "--preview-max-start": tokens["--effort-max-start"], "--preview-max": tokens["--effort-max-accent"]
  } as CSSProperties;
  return <div className="theme-strip-wrap">
    <Button type="button" className={`theme-card theme-strip${active ? " is-active" : ""}`} data-theme-id={entry.id}
      aria-pressed={active} aria-label={`${entry.label}${active ? "，当前主题" : "，应用主题"}`}
      style={style} onClick={() => service.appearance.activateTheme(entry.id)}>
      <span className="theme-miniature" aria-hidden="true">
        <span className="theme-mini-sidebar"><i /><i /><i /></span>
        <span className="theme-mini-chat"><i className="theme-mini-user" /><i /><i /><span className="theme-mini-composer"><i /></span></span>
      </span>
      <span className="theme-strip-identity">
        <span className="theme-strip-status">{active ? <><TrustedIcon name="check" size={12} /> 当前主题</> : "界面主题"}</span>
        <span className="theme-strip-name">{entry.label}</span>
        <span className="theme-strip-note">{entry.note || "你的专属工作空间"}</span>
      </span>
      <span className="theme-strip-palette">
        <span className="theme-strip-colors" role="img" aria-label={colors.map(([label, token]) => `${label} ${tokens[token]}`).join("，")}>
          {colors.map(([label, token]) => <i key={token} title={`${label} · ${tokens[token]}`} style={{ background: tokens[token] }} />)}
          <span aria-hidden="true">配色</span>
        </span>
        <span className="theme-effort-colors" role="img" aria-label={`思考强度：常规 ${tokens["--effort-accent"]} 至 ${tokens["--effort-accent-2"]}；Max ${tokens["--effort-max-start"]} 至 ${tokens["--effort-max-accent"]}`}>
          <span className="theme-effort-sample"><i /><span>常规思考</span></span>
          <span className="theme-effort-sample is-max"><i /><span>Max</span></span>
        </span>
      </span>
    </Button>
    {entry.removable || entry.user ? <Button type="button" className="icon-btn small danger theme-strip-remove" data-theme-remove={entry.id}
      title={`删除主题 ${entry.label}`} aria-label={`删除主题 ${entry.label}`} onClick={() => void service.appearance.removeTheme(entry.id)}><TrustedIcon name="trash" size={14} /></Button> : null}
  </div>;
}
