import { useEffect, useRef, useState } from 'react';
import { Button, ListItem, StatusText, Surface, TextField, FieldGroup } from '../../../shared/ui/primitives';
import { useStoreValue } from '../../../shared/state/react';
import { createReactDialogManager } from '../../../shared/overlays/dialog-service';
import { captureKnowledge, exportLibrary, importLibrary, normalizeLibraries, readKnowledgeFile, type KnowledgeFile } from '../domain/library';
import { saveLibrary } from '../services/library';
import { estimateContextTokens } from '../../context/public/domain_budget.js';

export function KnowledgeStatus({ store }: { store: any }) {
  const state = useStoreValue<any>(store, 'app');
  const conversation = state.conversations.find((item: any) => item.id === state.activeConversationId);
  const project = state.projects.find((item: any) => item.id === conversation?.projectId);
  const files = project ? normalizeLibraries(state.projectKnowledge, [project])[project.id] || [] : [];
  const context = captureKnowledge({ state, conversation });
  return <div className="knowledge-status">
    <a href="#/settings/knowledge">项目知识库{project ? ` · ${project.name}` : ''}</a>
    <StatusText>{context.error ? '资料不完整，发送已受阻' : project ? `${files.length} 份 · 下次请求完整携带 · 不参与压缩` : '会话加入项目后携带资料'}</StatusText>
  </div>;
}

export function KnowledgePane({ store, active = true }: { store: any; active?: boolean }) {
  const state = useStoreValue<any>(store, 'app');
  const activeProject = state.conversations.find((item: any) => item.id === state.activeConversationId)?.projectId;
  const [selectedProject, setProject] = useState(activeProject || '');
  const projectId = state.projects.some((item: any) => item.id === selectedProject) ? selectedProject : state.projects[0]?.id || '';
  const files = normalizeLibraries(state.projectKnowledge, state.projects)[projectId] || [];
  const [selected, setSelected] = useState('');
  const file = files.find(item => item.id === selected) || files[0];
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const upload = useRef<HTMLInputElement>(null);
  const replace = useRef<HTMLInputElement>(null);
  const restore = useRef<HTMLInputElement>(null);
  useEffect(() => { revision.current++; setFeedback(''); setBusy(false); return () => { revision.current++; }; }, [projectId, active]);

  async function operate(action: () => Promise<void | false>) {
    const version = revision.current;
    setBusy(true); setFeedback(''); setError(false);
    try { const result = await action(); if (version === revision.current) setFeedback(result === false ? '已取消，资料保持原状。' : '已保存到本地。项目每次请求将完整携带最新资料。'); }
    catch (cause) { if (version === revision.current) { setError(true); setFeedback(cause instanceof Error ? cause.message : String(cause)); } }
    finally { if (version === revision.current) setBusy(false); }
  }
  async function importFiles(inputs: File[], replacing?: string) {
    const version = revision.current;
    const before = JSON.stringify(files);
    const additions = await Promise.all(inputs.map(input => readKnowledgeFile(input, replacing)));
    if (version !== revision.current) return;
    const current = normalizeLibraries(store.state.projectKnowledge, store.state.projects)[projectId] || [];
    if (JSON.stringify(current) !== before) throw new Error('读取期间资料已变化，请重新上传。');
    const next = replacing ? current.map(item => item.id === replacing ? additions[0] : item) : [...current, ...additions];
    await saveLibrary(store, projectId, next);
    if (version === revision.current) setSelected(additions[0]?.id || '');
  }
  async function removeFile(target: KnowledgeFile) {
    const version = revision.current;
    if (!(await createReactDialogManager().confirm({ title: '删除项目资料', message: `删除「${target.name}」后，后续请求不再携带此文件；已开始的请求继续使用原快照。`, danger: true }))) return;
    if (version !== revision.current) return;
    await operate(() => saveLibrary(store, projectId, files.filter(item => item.id !== target.id)));
  }
  function backup() {
    try {
      const url = URL.createObjectURL(new Blob([exportLibrary(files)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'project-knowledge.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('已生成资料备份；包含完整正文，不包含供应商凭据。'); setError(false);
    } catch (cause) { setError(true); setFeedback((cause as Error).message); }
  }
  async function restoreBackup(input: File) {
    if (input.size > 64 * 1024 * 1024) throw new Error('备份文件过大，最多 64 MiB。');
    const version = revision.current;
    const restored = importLibrary(await input.text());
    if (version !== revision.current) return;
    if (!(await createReactDialogManager().confirm({ title: '恢复项目资料', message: `将用备份中的 ${restored.length} 份资料替换当前项目的全部资料。此操作不会更改聊天历史。`, confirmLabel: '替换资料' }))) return false;
    if (version !== revision.current) return;
    await saveLibrary(store, projectId, restored);
  }
  const context = captureKnowledge({ state, conversation: { projectId } });
  return <section className="settings-pane knowledge-pane" aria-label="项目知识库">
    <h2 className="settings-pane-title">项目知识库</h2>
    <p className="settings-pane-lede">文件在项目每次请求中完整携带，不参与历史压缩。修改只影响尚未开始的请求。</p>
    <FieldGroup id="knowledge-project" label="管理项目" hint="资料按项目隔离；无项目的会话不会携带任何项目资料。">
      <select id="knowledge-project" className="field" value={projectId} onChange={event => setProject(event.target.value)} disabled={busy || !state.projects.length}>
        {!state.projects.length && <option value="">暂无项目</option>}
        {state.projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
    </FieldGroup>
    {!projectId ? <Surface><p>先在聊天侧栏创建项目，再将会话加入项目，即可管理和使用资料。</p><a href="#/chat">返回聊天</a></Surface> : <>
      <div className="knowledge-actions">
        <Button className="btn btn-primary" disabled={busy} onClick={() => upload.current?.click()}>上传资料</Button>
        <Button className="btn btn-ghost" disabled={busy || !files.length} onClick={backup}>导出资料备份</Button>
        <Button className="btn btn-ghost" disabled={busy} onClick={() => restore.current?.click()}>恢复资料备份</Button>
      </div>
      <StatusText>UTF-8 文本 / Markdown / 代码 · 单文件 1 MiB · 每项目 8 MiB / 64 份 · 不支持 PDF、Word 或二进制文件</StatusText>
      <Surface className="knowledge-budget"><strong>{files.length} 份资料 · 约 {estimateContextTokens(context.text).toLocaleString()} Tokens</strong><p>{context.error || '正文与文件名全部计入固定上下文。这里是字符估算；实际供应商用量可能不同，发送前会统一检查完整预算。'}</p></Surface>
      <div className="knowledge-grid">
        <Surface className="knowledge-list" aria-label="资料文件列表">
          {!files.length && <p>尚未上传资料。项目聊天目前只使用已配置的指令与会话历史。</p>}
          {files.map(item => <ListItem key={item.id} disabled={busy} className={`knowledge-file ${file?.id === item.id ? 'is-selected' : ''}`} aria-pressed={file?.id === item.id} onClick={() => setSelected(item.id)}>
            <strong>{item.name}</strong><StatusText>{item.text === null ? '正文缺失 · 需替换或删除' : `${item.bytes.toLocaleString()} 字节`}</StatusText>
          </ListItem>)}
        </Surface>
        <Surface className="knowledge-preview" aria-label="文件全文预览">
          {file ? <><h3>{file.name}</h3><div className="knowledge-actions"><Button className="btn btn-ghost" disabled={busy} onClick={() => replace.current?.click()}>替换文件</Button><Button className="btn btn-ghost" disabled={busy} onClick={() => void removeFile(file)}>删除文件</Button></div>
            <pre>{file.text === null ? '正文不可用，请重新上传。系统不会忽略该文件继续发送。' : file.text || '（空文件）'}</pre></> : <p>选择文件后，在此查看完整正文。</p>}
        </Surface>
      </div>
    </>}
    <p role={error ? 'alert' : 'status'} className="knowledge-feedback">{busy ? '正在读取与保存…' : feedback}</p>
    <TextField ref={upload} type="file" hidden multiple aria-label="上传项目资料" onChange={event => { const inputs = Array.from(event.target.files || []); event.target.value = ''; if (inputs.length) void operate(() => importFiles(inputs)); }} />
    <TextField ref={replace} type="file" hidden aria-label="替换项目资料" onChange={event => { const input = event.target.files?.[0]; event.target.value = ''; if (input && file) void operate(() => importFiles([input], file.id)); }} />
    <TextField ref={restore} type="file" hidden accept=".json" aria-label="恢复项目资料备份" onChange={event => { const input = event.target.files?.[0]; event.target.value = ''; if (input) void operate(() => restoreBackup(input)); }} />
  </section>;
}
