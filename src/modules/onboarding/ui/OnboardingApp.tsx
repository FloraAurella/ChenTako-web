import { Button } from "../../../shared/ui/primitives";
import { useEffect, useState } from "react";
import { TrustedIcon, TrustedLogo } from "../../../shared/ui/Icon";

type Tone = "neutral" | "busy" | "success" | "error";

interface OnboardingStatus {
  required?: boolean;
  storageLocation?: string;
}

interface ActionResult {
  cancelled?: boolean;
}

interface OnboardingBridge {
  getStatus?: () => Promise<OnboardingStatus> | OnboardingStatus;
  startFresh: () => Promise<ActionResult | void>;
  importPackage: () => Promise<ActionResult | void>;
}

declare global {
  interface Window {
    "ai-chatbox"?: Window["clawbox"];
    clawbox?: {
      onboarding?: OnboardingBridge;
      [key: string]: unknown;
    };
  }
}

const bridge = (window["ai-chatbox"] ?? window.clawbox)?.onboarding || null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

export function OnboardingApp() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<Tone>("neutral");
  const [message, setMessage] = useState("");
  const [messageIcon, setMessageIcon] = useState<"refresh" | "check" | "">("");

  useEffect(() => {
    if ((window["ai-chatbox"] ?? window.clawbox)) document.body.classList.add("desktop-embed");
    const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyScheme = () => {
      const dark = schemeQuery.matches;
      document.documentElement.dataset.scheme = dark ? "dark" : "light";
      document.documentElement.dataset.theme = dark ? "night-orchard" : "juicy-pear";
      document.documentElement.dataset.themeBase = dark ? "dark" : "light";
    };
    applyScheme();
    schemeQuery.addEventListener?.("change", applyScheme);
    return () => schemeQuery.removeEventListener?.("change", applyScheme);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve(bridge?.getStatus?.())
      .then((nextStatus) => {
        if (!active) return;
        const resolved = nextStatus || {};
        setStatus(resolved);
        if (!bridge || resolved.required === false) {
          setTone("error");
          setMessage("仅在桌面应用首次启动时可用。");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus({ required: false });
        setTone("error");
        setMessage(`无法读取首次启动状态：${errorMessage(error)}`);
      });
    return () => { active = false; };
  }, []);

  async function runAction(kind: "fresh" | "import") {
    if (!bridge) return;
    const isImport = kind === "import";
    setBusy(true);
    setTone("busy");
    setMessageIcon("refresh");
    setMessage(isImport ? "正在选择并验证迁移包…" : "正在创建本机数据目录…");
    try {
      const result = isImport ? await bridge.importPackage() : await bridge.startFresh();
      if (result?.cancelled) {
        setBusy(false);
        setTone("neutral");
        setMessageIcon("");
        setMessage("已取消导入。");
        return;
      }
      setTone("success");
      setMessageIcon("check");
      setMessage("已完成，ChenTako 正在打开…");
    } catch (error) {
      setBusy(false);
      setTone("error");
      setMessageIcon("");
      setMessage(`未能完成：${errorMessage(error)}`);
    }
  }

  if (!status) return null;
  const disabled = busy || !bridge || status.required === false;

  return (
    <main className="onboarding-canvas">
      <div className="window-drag-band" aria-hidden="true" />
      <section
        className={`onboarding-shell${busy ? " is-busy" : ""}`}
        aria-labelledby="onboardingTitle"
        aria-busy={busy}
      >
        <header className="onboarding-brand">
          <TrustedLogo size={21} className="onboarding-logo" />
          <span>ChenTako</span>
          <span className="onboarding-local-label">LOCAL FIRST</span>
        </header>
        <div className="onboarding-grid">
          <div className="onboarding-copy">
            <p className="onboarding-eyebrow">首次使用</p>
            <h1 id="onboardingTitle">欢迎使用 ChenTako</h1>
            <p className="onboarding-lede">全新开始，或导入已有数据。数据保存在本机。</p>
            <div className="onboarding-actions">
              <Button
                type="button"
                className="onboarding-choice is-primary"
                id="onboardingFreshBtn"
                disabled={disabled}
                autoFocus={!disabled}
                onClick={() => void runAction("fresh")}
              >
                <TrustedIcon name="spark" size={19} className="choice-icon" />
                <span className="choice-copy"><strong>启动全新 ChenTako</strong><small>创建本机数据。</small></span>
                <TrustedIcon name="chevronRight" size={17} className="choice-arrow" />
              </Button>
              <Button
                type="button"
                className="onboarding-choice"
                id="onboardingImportBtn"
                disabled={disabled}
                onClick={() => void runAction("import")}
              >
                <TrustedIcon name="archive" size={19} className="choice-icon" />
                <span className="choice-copy"><strong>从迁移包导入</strong><small>恢复对话、主题与设置。</small></span>
                <TrustedIcon name="chevronRight" size={17} className="choice-arrow" />
              </Button>
            </div>
            <div className="onboarding-status" id="onboardingStatus" role="status" aria-live="polite" data-tone={tone}>
              {messageIcon ? <TrustedIcon name={messageIcon} size={14} /> : null}
              {messageIcon ? " " : ""}{message}
            </div>
          </div>
          <aside className="migration-seal" aria-label="迁移包由加密数据和密钥两个文件组成">
            <div className="seal-caption"><span>迁移封套</span><span>AES · 128 BIT</span></div>
            <div className="seal-stack">
              <div className="seal-file seal-data">
                <TrustedIcon name="database" size={22} className="seal-file-icon" />
                <span className="seal-file-type">ENCRYPTED DATA</span>
                <strong>ChenTako-Data</strong>
                <small>对话 · 附件 · 主题 · 设置</small>
              </div>
              <div className="seal-file seal-key">
                <TrustedIcon name="key" size={20} className="seal-file-icon" />
                <span className="seal-file-type">KEY.MD</span>
                <strong>128 位密钥</strong>
                <small>随迁移 ZIP 一起保存</small>
              </div>
              <span className="seal-stamp"><TrustedIcon name="shield" size={18} /> VERIFIED</span>
            </div>
            <p className="seal-note">导入前校验文件，失败不写入数据。</p>
          </aside>
        </div>
        <footer className="onboarding-footer">
          <span><TrustedIcon name="shield" size={13} /> 数据只写入这台 Mac</span>
          <code title={status.storageLocation || undefined}>{status.storageLocation || "本机应用数据目录"}</code>
        </footer>
      </section>
    </main>
  );
}
