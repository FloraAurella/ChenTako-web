import { isConversationLocked } from '../../chat/public/first-response.js';
import { useStoreValue } from '../../../shared/state/react';
import { useRef, useState, useEffect } from 'react';
import { Button, FieldGroup, TextField, StatusText } from '../../../shared/ui/primitives';
import { Modal } from '../../../shared/ui/Modal';
import { TrustedIcon } from '../../../shared/ui/Icon';
import { ExtensionSlot } from '../../../shared/state/contributions';
import { createReactDialogManager } from '../../../shared/overlays/dialog-service';

export function ProjectSettingsButton({ store, project }: { store: any; project: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  return <><Button className="icon-btn small" data-project-action="menu" aria-label={`${project.name}：项目设置`}
    aria-haspopup="dialog" aria-expanded={open} title="项目设置" onClick={() => setOpen(true)}><TrustedIcon name="more" size={16} /></Button>
    {open && <ProjectSettings store={store} project={project} onClose={() => setOpen(false)} />}
  </>;
}

function ProjectSettings({ store, project, onClose }: { store: any; project: { id: string; name: string }; onClose: () => void }) {
  useStoreValue(store, 'stream-list');
  const locked = store.state.conversations.some((c: any) => c.projectId === project.id && isConversationLocked(c));
  const [name, setName] = useState(project.name);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function rename() {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) { setError(trimmed ? '项目名称不能超过 60 个字符' : '项目名称不能为空'); return; }
    setBusy(true); setError(''); setFeedback('');
    try {
      if (!store.state.projects.some((item: any) => item.id === project.id)) throw new Error('项目已删除。');
      store.renameProject(project.id, trimmed);
      if (!(await store.persist())) throw new Error('名称仅保留在当前页面，持久化失败，请重试保存。');
      if (mounted.current) { setName(trimmed); setFeedback('项目名称已保存。'); }
    } catch (cause) { if (mounted.current) setError((cause as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    const confirmed = await createReactDialogManager().confirm({ title: '删除项目', message: `删除「${project.name}」及其知识库？全部聊天会保留并移到“无项目”。`, confirmLabel: '删除项目', danger: true });
    if (confirmed && mounted.current) { try { store.deleteProject(project.id); } catch (cause) { setError((cause as Error).message); } }
  }
  return <Modal title="项目设置" onClose={onClose} className="project-settings-dialog" returnFocusFallback="[data-project-action='create']">
    <form className="project-settings-form" onSubmit={event => { event.preventDefault(); void rename(); }}>
      <FieldGroup id="project-settings-name" label="项目名称" error={error}>
        <div className="project-settings-name-row"><TextField id="project-settings-name" className="field" value={name} disabled={busy}
          aria-invalid={!!error} aria-describedby={error ? 'project-settings-name-error' : undefined}
          onChange={event => { setName(event.target.value); setError(''); setFeedback(''); }}
          onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
          <Button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存名称'}</Button></div>
      </FieldGroup>
      <div className="project-settings-actions"><StatusText role="status">{feedback}</StatusText>
        <Button className="btn btn-destructive" title={locked ? "项目内有对话首次响应尚未结束" : undefined} disabled={busy || locked} onClick={() => void remove()}>删除项目</Button></div>
    </form>
    <ExtensionSlot name="project.settings" store={store} projectId={project.id} />
  </Modal>;
}
