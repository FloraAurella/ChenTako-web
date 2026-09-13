import { Button, TextField } from "../../../shared/ui/primitives";
import { useContributions } from '../../../shared/state/contributions';
import { useEffect, useState } from "react";
import { TrustedIcon } from "../../../shared/ui/Icon";

export function SettingsIndex({ section }: { section: string }) {
  const registry = useContributions().settings.list();
  const categories = registry.map(c => [c.id,c.label,c.icon,c.description]);
  const entries = registry.flatMap(c => c.search.map(e => [c.id,e.id,e.title,e.keywords]));
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ section: string; id: string } | null>(null);
  const matches = entries.filter((entry) => `${entry[2]} ${entry[3]}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    if (!target || target.section !== section) return;
    const timer = setTimeout(() => {
      const element = document.getElementById(target.id) || document.querySelector<HTMLElement>("#settingsContent .settings-pane");
      for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      element?.scrollIntoView({ block: "start", behavior: "instant" });
      element?.focus({ preventScroll: true });
      setTarget(null);
    }, 80);
    return () => clearTimeout(timer);
  }, [section, target]);
  return <aside className="settings-index" id="settingsIndex" aria-label="设置目录"><h2 className="settings-index-title">偏好设置</h2><label className="settings-search"><TrustedIcon name="search" size={16} /><TextField type="search" aria-label="搜索设置" placeholder="搜索设置…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    {query.trim() ? <div className="settings-search-results"><p role="status">{matches.length ? `${matches.length} 项匹配` : "没有匹配设置。"}</p>{matches.map(([key, id, title]) => <Button type="button" className="settings-nav-item" key={`${key}-${id}`} onClick={() => { setTarget({ section: key, id }); location.hash = `#/settings/${key}`; }}><span><strong>{title}</strong><small>{categories.find((c) => c[0] === key)?.[1]}</small></span></Button>)}</div>
      : <nav aria-label="设置分类">{categories.map(([key, label, icon]) => <Button type="button" key={key} className={`settings-nav-item${section === key ? " is-active" : ""}`} aria-current={section === key ? "page" : undefined} data-section={key}><TrustedIcon name={icon} size={18} /><span><strong>{label}</strong></span></Button>)}</nav>}
  </aside>;
}
