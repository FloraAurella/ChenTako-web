import { useEffect, useRef, useState } from 'react';
import { Button, ListItem, StatusText, Surface, TextField } from '../../../shared/ui/primitives';
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
  if (!context.error && (!project || !files.length)) return null;
  return <div className="knowledge-status">
    <span>项目知识库{project ? ` · ${project.name}` : ''}</span>
    <StatusText>{context.error ? '资料缺失，无法发送' : project ? `${files.length} 份 · 全文携带` : '加入项目后携带资料'}</StatusText>
  </div>;
}

export function KnowledgePane({ store, projectId, active = true }: { store: any; projectId: string; active?: boolean }) {
  const state = useStoreValue<any>(store, 'app');
  const files = normalizeLibraries(state.projectKnowledge, state.projects)[projectId] || [];
  const [selected, setSelected] = useState('');
  const file = files.find(item => item.id === selected) || files[0];
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const operating = useRef(false);
  const upload = useRef<HTMLInputElement>(null);
  const replace = useRef<HTMLInputElement>(null);
  const restore = useRef<HTMLInputElement>(null);
  useEffect(() => { revision.current++; operating.current = false; setFeedback(''); setBusy(false); return () => { revision.current++; }; }, [projectId, active]);

  async function operate(action: () => Promise<void | false>) {
    if (operating.current) return;
    operating.current = true;
    const version = revision.current;
    setBusy(true); setFeedback(''); setError(false);
    try { const result = await action(); if (version === revision.current) setFeedback(result === false ? '已取消。' : '已保存到本地。'); }
    catch (cause) { if (version === revision.current) { setError(true); setFeedback(cause instanceof Error ? cause.message : String(cause)); } }
    finally { if (version === revision.current) { operating.current = false; setBusy(false); } }
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
    if (!(await createReactDialogManager().confirm({ title: '删除项目资料', message: `删除「${target.name}」？已开始的请求不受影响。`, danger: true }))) return;
    if (version !== revision.current) return;
    await operate(() => saveLibrary(store, projectId, files.filter(item => item.id !== target.id)));
  }
  function backup() {
    try {
      const url = URL.createObjectURL(new Blob([exportLibrary(files)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'project-knowledge.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('已导出完整资料备份。'); setError(false);
    } catch (cause) { setError(true); setFeedback((cause as Error).message); }
  }
  async function restoreBackup(input: File) {
    if (input.size > 64 * 1024 * 1024) throw new Error('备份文件过大，最多 64 MiB。');
    const version = revision.current;
    const restored = importLibrary(await input.text());
    if (version !== revision.current) return;
    if (!(await createReactDialogManager().confirm({ title: '恢复项目资料', message: `用备份中的 ${restored.length} 份资料替换本项目全部资料？聊天记录不变。`, confirmLabel: '替换资料' }))) return false;
    if (version !== revision.current) return;
    await saveLibrary(store, projectId, restored);
  }
  const context = captureKnowledge({ state, conversation: { projectId } });
  return <section className="knowledge-pane" aria-label="项目知识库">
    <h2 className="knowledge-title">项目知识库</h2>
    <p className="knowledge-description">每次全文携带，不参与压缩；修改对后续请求生效。</p>
    {!projectId ? <Surface><p>先在聊天侧栏创建项目，再将会话加入项目，即可管理和使用资料。</p><a href="#/chat">返回聊天</a></Surface> : <>
      <div className="knowledge-actions">
        <Button className="btn btn-primary" disabled={busy} onClick={() => upload.current?.click()}>上传资料</Button>
        <Button className="btn btn-ghost" disabled={busy || !files.length} onClick={backup}>导出资料备份</Button>
        <Button className="btn btn-ghost" disabled={busy} onClick={() => restore.current?.click()}>恢复资料备份</Button>
      </div>
      <StatusText>UTF-8 文本、Markdown、代码 · 单文件 1 MiB · 共 8 MiB / 64 份。不支持 PDF、Word、二进制。</StatusText>
      <Surface className="knowledge-budget"><strong>{files.length} 份资料 · 约 {estimateContextTokens(context.text).toLocaleString()} Tokens</strong>{files.length > 0 && <p>{context.error || '含文件名与正文的估算值，发送前检查预算。'}</p>}</Surface>
      <div className="knowledge-grid">
        <Surface className="knowledge-list" aria-label="资料文件列表">
          {!files.length && <p>尚未上传资料。</p>}
          {files.map(item => <ListItem key={item.id} disabled={busy} className={`knowledge-file ${file?.id === item.id ? 'is-selected' : ''}`} aria-pressed={file?.id === item.id} onClick={() => setSelected(item.id)}>
            <strong>{item.name}</strong><StatusText>{item.text === null ? '正文缺失 · 需替换或删除' : `${item.bytes.toLocaleString()} 字节`}</StatusText>
          </ListItem>)}
        </Surface>
        {file && <Surface className="knowledge-preview" aria-label="文件全文预览">
          {file ? <><h3>{file.name}</h3><div className="knowledge-actions"><Button className="btn btn-ghost" disabled={busy} onClick={() => replace.current?.click()}>替换文件</Button><Button className="btn btn-ghost" disabled={busy} onClick={() => void removeFile(file)}>删除文件</Button></div>
            <pre>{file.text === null ? '正文缺失，请替换或删除后发送。' : file.text || '（空文件）'}</pre></> : <p>选择文件查看全文。</p>}
        </Surface>}
      </div>
    </>}
    <p role={error ? 'alert' : 'status'} className="knowledge-feedback">{busy ? '正在读取与保存…' : feedback}</p>
    <TextField ref={upload} type="file" hidden multiple aria-label="上传项目资料" onChange={event => { const inputs = Array.from(event.target.files || []); event.target.value = ''; if (inputs.length) void operate(() => importFiles(inputs)); }} />
    <TextField ref={replace} type="file" hidden aria-label="替换项目资料" onChange={event => { const input = event.target.files?.[0]; event.target.value = ''; if (input && file) void operate(() => importFiles([input], file.id)); }} />
    <TextField ref={restore} type="file" hidden accept=".json" aria-label="恢复项目资料备份" onChange={event => { const input = event.target.files?.[0]; event.target.value = ''; if (input) void operate(() => restoreBackup(input)); }} />
  </section>;
}
