from pathlib import Path
import json,re
changes=[]
def edit(path,pairs):
 p=Path(path);s=p.read_text()
 for old,new in pairs:
  if old not in s: raise Exception(f'Missing in {path}: {old}')
  changes.append({'file':path,'before':old,'after':new});s=s.replace(old,new)
 p.write_text(s)
base='src/modules/'
# Descriptions that merely repeat headings are removed at their feature-owned source.
for name in ['appearance/ui/AppearancePane.tsx','data/ui/DataPane.tsx','context/ui/ContextPane.tsx','connections/ui/ProvidersPane.tsx']:
 p=Path(base+name);s=p.read_text();pairs=[(m.group(), '') for m in re.finditer(r'<p className="settings-pane-lede">[^<{]*</p>',s)];edit(str(p),pairs)
for name in ['appearance/ui/AppearancePane.tsx','data/ui/DataPane.tsx','context/ui/ContextPane.tsx']:
 p=Path(base+name);s=p.read_text();pairs=[]
 for m in re.finditer(r'(<SettingsGroup[^>]*?) description="[^"]*"',s):pairs.append((m.group(),m.group(1)))
 edit(str(p),pairs)
edit('src/shared/ui/SettingsCard.tsx', [('description: string; children: ReactNode','description?: string; children: ReactNode'),('<p className="settings-card-desc">{description}</p></header>','{description ? <p className="settings-card-desc">{description}</p> : null}</header>')])
edit(base+'appearance/ui/AppearancePane.tsx',[
('调整背景与卡片之间的明暗差异。','背景与卡片的明暗差异。'),
('description={`选择浅色、深色或跟随系统${mode === "system" ? `（当前${scheme === "dark" ? "深色" : "浅色"}）` : ""}。`}', 'description={mode === "system" ? `当前为${scheme === "dark" ? "深色" : "浅色"}` : undefined}'),
('<p className="settings-card-desc">界面配色与思考强度，一览可见。</p>',''),
('导入 ai-chatbox 主题 JSON，或把当前主题导出为可分享的文件。','支持 ai-chatbox 主题 JSON。'),
('当前使用「${themeLabel}」${scheme === "dark" ? "深色" : "浅色"}配色，调整即时生效。','${themeLabel} · ${scheme === "dark" ? "深色" : "浅色"} · 即时生效'),
('让卡片与对话框呈现柔和的毛玻璃效果。','卡片与弹窗使用毛玻璃。')])
edit(base+'context/ui/ContextPane.tsx',[
('描述助手的角色、回答方式和需要遵守的要求…','助手角色、回答方式与要求…'),
('{control}<p className="field-help">{hint}</p>','{control}{hint ? <p className="field-help">{hint}</p> : null}'),
('其余项目设置持续继承聊天默认值','其余设置继承默认值'),('项目未覆盖的设置也会跟随更新','项目未自定义时跟随更新'),
('项目提示词整体覆盖聊天提示词；自定义为空表示不使用提示词。','覆盖默认提示词；留空则不使用。'),
('从下一次发送起生效，切换模型时保留。','下次发送生效，切换模型时保留。'),
('"技能和必要的工具运行指令由应用单独添加。"','""'),
(' description="控制发送多少上下文，保留模型窗口与输出额度的安全余量。"',''),
('留空自动计算：模型窗口 − 最大输出 − 5% 窗口安全余量。','留空 = 模型窗口 − 最大输出 − 5% 安全余量。'),
('达到阈值时压缩已完成的历史，不按固定轮数保留；会产生额外模型请求，聊天记录不会删除。','达阈值后额外请求模型压缩历史，保留聊天记录。'),
('占用达到输入预算的此比例时，在发送前压缩一次。','达到输入预算的此比例时压缩。'),
('实际发送使用当前会话模型；附件与工具内容采用保守估算。','按当前模型发送，用量为估算。'),
('实际适用参数由模型与 API 协议决定。','以模型和 API 支持为准。'),
('聊天工具栏可临时覆盖，也可恢复跟随配置。','可在聊天中临时调整。'),
('控制采样随机性；部分推理模型不接受此参数。','随机性；部分推理模型不支持。'),
('控制采样候选范围；Gemini 思考模式不发送采样参数。','采样范围；Gemini 思考模式不使用。'),
('边生成边显示；关闭后等待完整响应。','边生成边显示。'),
('用于新建会话；已有会话保留原保存状态。','仅影响新会话。'),
('可选；Gemini 不发送此字段，其他协议按各自格式传递。','可选；Gemini 不使用。'),
('全局配置，不参与项目继承。用于纠正模型图片能力的自动识别。','手动修正图片能力，对所有项目生效。'),
('请先在“模型与供应商”中添加模型。','请先添加模型。')])
edit(base+'connections/ui/provider-workspace.tsx',[
('还没有供应商，请添加一个 API 协议。','暂无供应商'),('<p>设置 API 地址、协议和凭据。</p>',''),
('API Key 会立即同步，其他设置需手动保存。','Key 自动同步，其他更改需保存。'),
('禁用后不再出现在模型选择器中。','禁用后不参与模型选择。'),
('设置模型参数，未配置项继承默认值。','未配置项继承默认值。'),
('尚未添加模型，可手动添加或从接口读取。','暂无模型，可添加或从接口读取。'),
('提示词、生成参数与模型兼容性请前往“上下文与提示词”设置。','生成参数见“上下文与提示词”。'),
('连接配置有未保存的更改','有未保存的更改'),('连接配置已保存','已保存'),
('<p>选择现有供应商或添加新供应商。</p>','')])
edit(base+'connections/ui/provider-dialogs.tsx',[
('<span className="provider-dialog-eyebrow">New connection</span>',''),
('<span className="provider-dialog-eyebrow">{defaults ? "Model defaults" : "Model profile"}</span>',''),
('未单独配置的模型会继承这些参数。','未自定义的模型使用这些默认值。'),
('仅配置模型的上下文窗口与最大输出额度。','设置上下文与输出限额。')])
edit(base+'knowledge/ui/KnowledgePane.tsx',[
('资料不完整，发送已受阻','资料缺失，无法发送'),
('${files.length} 份 · 下次请求完整携带 · 不参与压缩','${files.length} 份 · 全文携带'),
('会话加入项目后携带资料','加入项目后携带资料'),
('已取消，资料保持原状。','已取消。'),('已保存到本地。项目每次请求将完整携带最新资料。','已保存到本地。'),
('已生成资料备份；包含完整正文，不包含供应商凭据。','已导出完整资料备份。'),
('文件在项目每次请求中完整携带，不参与历史压缩。修改只影响尚未开始的请求。','每次全文携带，不参与压缩；修改对后续请求生效。'),
('UTF-8 文本 / Markdown / 代码 · 单文件 1 MiB · 每项目 8 MiB / 64 份 · 不支持 PDF、Word 或二进制文件','UTF-8 文本、Markdown、代码 · 单文件 1 MiB · 共 8 MiB / 64 份。不支持 PDF、Word、二进制。'),
('正文与文件名全部计入固定上下文。这里是字符估算；实际供应商用量可能不同，发送前会统一检查完整预算。','含文件名与正文的估算值，发送前检查预算。'),
('尚未上传资料。项目聊天目前只使用已配置的指令与会话历史。','尚未上传资料。'),
('正文不可用，请重新上传。系统不会忽略该文件继续发送。','正文缺失，请替换或删除后发送。'),
('选择文件后，在此查看完整正文。','选择文件查看全文。'),
('删除「${target.name}」后，后续请求不再携带此文件；已开始的请求继续使用原快照。','删除「${target.name}」？已开始的请求不受影响。'),
('将用备份中的 ${restored.length} 份资料替换当前项目的全部资料。此操作不会更改聊天历史。','用备份中的 ${restored.length} 份资料替换本项目全部资料？聊天记录不变。')])
edit(base+'projects/ui/ProjectSettingsButton.tsx',[
('删除「${project.name}」后，其中的全部聊天会保留并移到“无项目”，该项目的知识库资料将一并移除。','删除「${project.name}」及其知识库？全部聊天会保留并移到“无项目”。'),
("{feedback || '更改名称不会影响项目中的聊天与资料。'}",'{feedback}')])
edit(base+'settings/ui/SettingsIndex.tsx', [('没有匹配设置，试试“提示词”或“主题”。','没有匹配设置。')])
edit(base+'extensions/ui/ExtensionsPane.tsx',[
(' lede: string;', ''),(' lede: "保留自定义 HTTP 工具的配置入口；当前版本工具执行尚未开放。",',''),(' lede: "导入并管理可复用的模型指令；当前版本执行尚未开放。",',''),
('设置工具地址、输入 Schema 和启用状态，供后续版本执行时使用。',''),
('当前版本仅保留配置与导入入口：工具与技能的执行尚未开放，携带非空 <code className="inline-code">extensions</code> 的请求会被本地服务明确拒绝，不会静默忽略。','执行尚未开放；当前仅可管理配置，启用后相关请求会被拒绝。'),
('在无网络 Linux 虚拟机中运行 Python 的能力预留；本版本仅保留配置。','仅配置，暂不执行。'),
('在无网络临时工作目录运行受控命令的能力预留；本版本仅保留配置。','仅配置，暂不执行。'),
('<p className="settings-pane-lede">{current.lede}</p>',''),
('<p className="settings-card-desc">{current.desc}</p>','{current.desc ? <p className="settings-card-desc">{current.desc}</p> : null}'),
('<p className="settings-pane-lede">名称会作为模型函数名，输入 Schema 必须是 object。</p>',''),
('启用后保留该配置；本版本不会实际调用。','仅保存启用状态，暂不执行。'),
('保存后保留配置；工具执行待后续版本开放','工具执行尚未开放'),
('还没有技能，上传 Markdown 或压缩包开始。','暂无技能。'),('还没有工具。','暂无工具。'),
('使用 POST JSON 调用，仅支持 HTTPS 或本机回环 HTTP。','POST JSON；仅支持 HTTPS 或本机 HTTP。')])
edit(base+'data/ui/DataPane.tsx',[
('正在检查数据位置和运行环境。','检查中…'),('将本机数据导出为加密迁移包。','导出本机数据。'),
('<p className="migration-kicker">完整快照 · 加密导出</p>',''),
('迁移包包含密文和 key.md，请作为敏感文件保管。','迁移包含密钥，请妥善保管。'),
('升级时保留的旧行为设置，仅供查阅，不再自动生效。备份不包含 API Key。','仅供查阅，不自动生效；不含 API Key。'),
('没有需要迁移的旧配置。','暂无旧配置。')])
edit(base+'onboarding/ui/OnboardingApp.tsx',[
('此页面只能在 ai-chatbox 首次启动时使用。','仅在桌面应用首次启动时可用。'),
('已取消导入；你仍可以选择任一种启动方式。','已取消导入。'),
('FIRST OPEN · 第一次打开','首次使用'),('从这里，决定第一份记忆','欢迎使用 ai-chatbox'),
('ai-chatbox 没有云端账户。请选择建立一套全新的本机数据，或把另一台设备的对话、主题与设置带到这里。','全新开始，或导入已有数据。数据保存在本机。'),
('创建空白的隐藏数据目录，从一段新对话开始。','创建本机数据。'),
('选择 ai-chatbox Migration ZIP，验证后原子恢复本机数据。','恢复对话、主题与设置。'),
('导入前会检查文件路径、AES-GCM 完整性与逐文件 SHA-256 清单；失败不会创建半成品数据目录。','导入前校验文件，失败不写入数据。')])
edit(base+'chat/ui/ChatSurface.tsx', [('输入消息，或输入 / 使用指令','输入消息，/ 打开指令'),('Enter 发送 · Shift + Enter 换行 · / 指令','Enter 发送 · Shift + Enter 换行')])
edit(base+'chat/services/message-rendering.js',[
('无法连接本地服务，请确认后端已启动。你仍可输入 /help 查看指令。','请启动本地服务，或检查连接设置。'),
('正在检查本地服务，稍后即可确认连接状态。','请稍候…'),
('直接写下问题，或输入 / 切换模型、调整强度和查看帮助。','输入问题，开始对话。'),
('请先在设置中配置并启用供应商，再使用 /model 选择模型。','添加供应商并选择模型后即可聊天。')])
edit(base+'chat/services/popover-markup.js', [('字符估算，含请求结构开销 · 点击压缩历史 · 将请求当前模型','估算含请求开销 · 点击请求模型压缩历史')])
Path('reports/concise-copy-2026-09-13/changes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2))
print(f'{len(changes)} edits')
