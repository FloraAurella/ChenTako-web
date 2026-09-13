import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProviderSettingsService } from '../src/modules/connections/services/provider-service';
import { createSettingsStateBridge } from '../src/contracts/settings';
import { normalizeProvider } from '../src/contracts/normalize.js';
import { apiFetch } from '../src/shared/api.js';
vi.mock('../src/shared/api.js', () => ({ apiFetch: vi.fn() }));
vi.mock('../src/modules/connections/services/provider-key-vault', () => ({ providerKeyVault: { save: vi.fn(), load: vi.fn(), remove: vi.fn() } }));
const services: ReturnType<typeof createProviderSettingsService>[] = [];
const request = vi.mocked(apiFetch);
function setup() {
  const providers = ['a', 'b'].map(id => normalizeProvider({ id, displayName: id, baseUrl: 'https://example.com/v1', models: ['m1', 'm2'], defaultModel: 'm1' }));
  const store: any = { state: { providers, modelCompatibility: {} }, notify: vi.fn(), persist: vi.fn().mockResolvedValue(true), actions: { setProviders: (value: any) => { store.state.providers = value; } } };
  const bridge = createSettingsStateBridge();
  const dialogs = { confirm: vi.fn().mockResolvedValue(true), prompt: vi.fn(), previewHtml: vi.fn() };
  const service = createProviderSettingsService({ store, dialogs, theme: {}, toast: vi.fn() }, bridge);
  services.push(service); service.beginEdit('a');
  request.mockImplementation(async (_url, options: any) => new Response(JSON.stringify({ provider: JSON.parse(options.body) })));
  return { service, store, bridge, dialogs };
}
beforeEach(() => { vi.useFakeTimers(); request.mockReset(); });
afterEach(() => { services.splice(0).forEach(s => s.releaseEditor()); vi.useRealTimers(); });
describe('provider automatic saves', () => {
  it('commits toggles immediately and text after input settles', async () => {
    const { service, store, bridge } = setup();
    service.toggleFlag('enabled'); await service.save();
    expect(store.state.providers[0].enabled).toBe(false);
    service.setField('displayName', 'renamed');
    await vi.advanceTimersByTimeAsync(319); expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.state.providers[0].displayName).toBe('renamed');
    expect(bridge.get().providerEditing?.dirty).toBe(false);
  });
  it('never submits intermediate IME composition', async () => {
    const { service, store } = setup();
    service.setComposing(true); service.setField('displayName', 'zhong');
    await vi.advanceTimersByTimeAsync(500); expect(request).not.toHaveBeenCalled();
    service.setField('displayName', '中文'); service.setComposing(false);
    await vi.advanceTimersByTimeAsync(320); expect(store.state.providers[0].displayName).toBe('中文');
  });
  it('serializes rapid edits and never replaces newer input with an old response', async () => {
    const { service, bridge, store } = setup();
    let resolve!: (value: Response) => void;
    request.mockImplementationOnce((_url, options: any) => new Promise(r => { resolve = r; }));
    service.setField('displayName', 'first'); const first = service.save();
    await vi.advanceTimersByTimeAsync(0);
    const firstBody = JSON.parse((request.mock.calls[0][1] as any).body);
    service.setField('displayName', 'second'); const second = service.save();
    expect(request).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ provider: firstBody }))); await first;
    expect(bridge.get().providerEditing?.draft.displayName).toBe('second');
    await second; expect(store.state.providers[0].displayName).toBe('second');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('retains invalid and failed input, and supports explicit retry', async () => {
    const { service, bridge } = setup();
    service.setField('baseUrl', 'invalid'); expect(await service.save()).toBe(false);
    expect(request).not.toHaveBeenCalled(); expect(bridge.get().providerEditing?.saveError).toContain('Base URL');
    service.setField('baseUrl', 'https://new.example.com');
    request.mockResolvedValueOnce(new Response('{"error":"offline"}', { status: 503 }));
    expect(await service.save()).toBe(false);
    expect(bridge.get().providerEditing?.draft.baseUrl).toBe('https://new.example.com');
    expect(bridge.get().providerEditing?.dirty).toBe(true);
    expect(await service.save()).toBe(true);
  });
  it('restoring the original value clears obsolete validation errors', async () => {
    const { service, bridge } = setup();
    service.setField('baseUrl', 'invalid'); await service.save();
    service.setField('baseUrl', 'https://example.com/v1'); await service.save();
    expect(bridge.get().providerEditing?.saveError).toBe('');
    expect(bridge.get().providerEditing?.dirty).toBe(false);
  });
  it('does not claim success when local persistence fails after server success' , async () => {
    const { service, bridge, store } = setup();
    store.persist.mockResolvedValueOnce(false);
    service.setField('displayName', 'kept'); expect(await service.save()).toBe(false);
    expect(bridge.get().providerEditing?.saveError).toContain('本地存储');
    expect(bridge.get().providerEditing?.draft.displayName).toBe('kept');
    expect(await service.save()).toBe(true);
  });
  it('saves before switching providers without asking to discard first-level edits', async () => {
    const { service, bridge, store, dialogs } = setup();
    service.setField('displayName', 'committed');
    expect(await service.select('b')).toBe(true);
    expect(store.state.providers[0].displayName).toBe('committed');
    expect(bridge.get().providerEditing?.draft.id).toBe('b'); expect(dialogs.confirm).not.toHaveBeenCalled();
  });
  it('keeps second-level parameters staged until Save, and persists renamed model and default together', async () => {
    const { service, store } = setup();
    service.openModel('m1'); service.setModelField('id', 'renamed');
    await vi.advanceTimersByTimeAsync(500); expect(request).not.toHaveBeenCalled();
    expect(store.state.providers[0].models).toContain('m1');
    expect(await service.applyModel()).toBe(true);
    expect(store.state.providers[0].defaultModel).toBe('renamed');
    expect(store.state.providers[0].models).toEqual(['renamed', 'm2']);
  });
  it('retains second-level editor on failure and retries without a duplicate-model error', async () => {
    const { service, bridge, store } = setup();
    service.openModel('m1'); service.setModelField('id', 'renamed');
    request.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    expect(await service.applyModel()).toBe(false);
    expect(bridge.get().providerEditing?.modelEditing?.draft.id).toBe('renamed');
    expect(await service.applyModel()).toBe(true);
    expect(store.state.providers[0].defaultModel).toBe('renamed');
  });
  it('can remove the last model and persist an empty list', async () => {
    const { service, store } = setup();
    await service.removeModel('m1'); await service.removeModel('m2');
    expect(store.state.providers[0].models).toEqual([]);
  });
  it('cancels queued writes and ignores late responses after unmount', async () => {
    const { service, bridge } = setup();
    let resolve!: (value: Response) => void;
    request.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    service.setField('displayName', 'pending'); const saving = service.save();
    await vi.advanceTimersByTimeAsync(0); service.releaseEditor();
    bridge.patch({ providerEditing: null });
    resolve(new Response(JSON.stringify({ provider: { id: 'a' } }))); await saving;
    expect(bridge.get().providerEditing).toBeNull();
  });
});
