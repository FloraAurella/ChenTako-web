import type { BackendContributions, BackendModule } from '../../contracts/contributions.ts';
import { serviceOf } from '../../contracts/contributions.ts';
import { HttpError, readJsonBody, sendJson, type RouteContribution } from '../../core/router.ts';
import type { UpstreamService } from '../upstream/public/module.ts';
import { testModel } from './services/test-model.ts';
import type { ProviderRepository } from './services/repository.ts';
import { publicView, validateApiKey, ProviderError } from './domain/registry-rules.ts';

/**
 * providers：供应商注册表 CRUD 与 API Key 保险库的后端端点。
 * 注册表是上游请求的权威配置；Key 只进加密库，从不回传到列表视图。
 */
export const createProvidersModule = (createStore: (services: BackendContributions) => ProviderRepository): BackendModule => ({
  id: 'providers',
  dependsOn: ['gateway', 'upstream'],
  setup({ services, scope }) {
    const register = (route: RouteContribution) => { scope.defer(services.routes.register('providers', route)); };
    const store = createStore(services);
    scope.defer(() => store.close());
    scope.defer(services.services.register('providers', { id: 'providers.store', value: store }));
    const upstream = serviceOf<UpstreamService>(services.services, 'upstream');
    const bodyLimit = services.config.bodyLimitBytes;
    const ssrfAllow = services.config.ssrfAllow;

    register({
      id: 'providers-list',
      method: 'GET',
      pattern: '/api/providers',
      handler: ({ res }) => {
        sendJson(res, 200, {
          providers: store.list().map((provider) => publicView(provider, store.hasKey(provider.keyEnv)))
        });
      }
    });

    register({
      id: 'providers-upsert',
      method: 'PUT',
      pattern: '/api/providers',
      handler: async ({ req, res }) => {
        const body = await readJsonBody(req, bodyLimit);
        if (body.apiKey !== undefined && String(body.apiKey).trim()) {
          const keyCheck = validateApiKey(body.apiKey);
          if (!keyCheck.ok) throw new HttpError(keyCheck.error!, 400);
          body.apiKey = keyCheck.value;
        }
        try {
          const { provider, keyEnv } = store.upsert(body, body.apiKey);
          sendJson(res, 200, {
            ok: true,
            provider: publicView(provider, store.hasKey(provider.keyEnv)),
            keyEnv
          });
        } catch (error) {
          if (error instanceof ProviderError) throw new HttpError(error.message, 400, error.code);
          throw error;
        }
      }
    });

    // /api/providers/key 必须先于 /api/providers/:id 注册（路由按注册顺序匹配）。
    register({
      id: 'providers-key-get',
      method: 'GET',
      pattern: '/api/providers/key',
      handler: ({ req, res }) => {
        const providerId = String(new URL(req.url || '/', 'http://localhost').searchParams.get('id') || '').trim();
        const provider = store.list().find((item) => item.id === providerId);
        if (!provider) throw new HttpError('供应商不存在于注册表', 404);
        const apiKey = store.resolveKey(provider);
        if (!apiKey) throw new HttpError('该供应商没有可显示的 API Key', 404);
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        sendJson(res, 200, { ok: true, apiKey });
      }
    });

    register({
      id: 'providers-key-put',
      method: 'PUT',
      pattern: '/api/providers/key',
      handler: async ({ req, res }) => {
        const body = await readJsonBody(req, bodyLimit);
        const keyCheck = validateApiKey(body.apiKey);
        if (!keyCheck.ok) throw new HttpError(keyCheck.error!, 400);
        try {
          const keyEnv = store.saveKey(String(body.displayName || ''), keyCheck.value!, String(body.id || ''));
          sendJson(res, 200, { ok: true, keyEnv, hasKeyConfigured: true });
        } catch (error) {
          if ((error as { code?: string }).code === 'PROVIDER_NOT_FOUND') throw new HttpError((error as Error).message, 404);
          throw error;
        }
      }
    });

    register({
      id: 'providers-key-delete',
      method: 'DELETE',
      pattern: '/api/providers/key',
      handler: async ({ req, res }) => {
        const body = await readJsonBody(req, bodyLimit);
        const removed = store.removeKey(String(body.id || ''), String(body.displayName || ''));
        sendJson(res, 200, { ok: true, removed });
      }
    });

    register({
      id: 'providers-test',
      method: 'POST',
      pattern: '/api/providers/test',
      handler: async ({ req, res }) => {
        const body = await readJsonBody(req, bodyLimit);
        const baseUrl = String(body.baseUrl || '').trim();
        const responseFormat = (['responses', 'anthropic', 'openai-compatible', 'google'].includes(String(body.responseFormat))
          ? String(body.responseFormat)
          : 'openai-compatible') as Parameters<UpstreamService['listModels']>[0]['responseFormat'];
        if (!baseUrl) throw new HttpError('请先填写 API Base URL', 400);
        const ssrfCheck = await upstream.validateUpstreamUrl(baseUrl, ssrfAllow);
        if (!ssrfCheck.ok) throw new HttpError(`上游地址被拒绝：${ssrfCheck.reason}`, 400);

        const inlineKey = String(body.apiKey || '').trim();
        if (inlineKey) {
          const keyCheck = validateApiKey(inlineKey);
          if (!keyCheck.ok) throw new HttpError(keyCheck.error!, 400);
        }
        const registered = body.id || (body.displayName && body.baseUrl)
          ? store.match({ id: String(body.id || ''), displayName: String(body.displayName || ''), baseUrl })
          : null;
        const apiKey = inlineKey || (registered ? store.resolveKey(registered) : '');
        if (!apiKey && !upstream.isLoopbackBaseUrl(baseUrl)) {
          throw new HttpError('没有可用于测试的 API Key，请先填写 Key 或保存已有配置', 401);
        }
        const model = body.model === undefined ? '' : String(body.model).trim();
        if (body.model !== undefined && (typeof body.model !== 'string' || !model || model.length > 256)) throw new HttpError('模型 ID 必须为 1–256 字符', 400);
        const controller = new AbortController();
        const disconnect = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', disconnect);
        const timeout = setTimeout(() => controller.abort(), 15 * 1000);
        try {
          if (model) {
            sendJson(res, 200, await testModel(upstream, { baseUrl, responseFormat, apiKey, model, signal: controller.signal }));
            return;
          }
          const { models, latencyMs } = await upstream.listModels({ baseUrl, responseFormat, apiKey, signal: controller.signal });
          sendJson(res, 200, {
            ok: true,
            latencyMs,
            models,
            message: models.length ? `连接成功，读取到 ${models.length} 个模型` : '连接成功，但接口未返回模型列表'
          });
        } catch (error) {
          const aborted = controller.signal.aborted || (error as Error).name === 'AbortError';
          if (aborted) throw new HttpError('连接测试超时（15 秒）', 504);
          if (error instanceof HttpError) throw error;
          const upstreamStatus = (error as { upstreamStatus?: number }).upstreamStatus;
          const status = typeof upstreamStatus === 'number' && upstreamStatus >= 400 && upstreamStatus <= 599 ? upstreamStatus : 502;
          throw new HttpError((error as Error).message || '无法连接上游服务', status);
        } finally {
          clearTimeout(timeout);
          res.off('close', disconnect);
        }
      }
    });

    register({
      id: 'providers-remove',
      method: 'DELETE',
      pattern: '/api/providers/:id',
      handler: async ({ req, res, params }) => {
        const body = await readJsonBody(req, bodyLimit);
        const result = store.remove(params.id ?? '', { displayName: body.displayName, baseUrl: body.baseUrl });
        if (!result.removed) throw new HttpError('供应商不存在于注册表', 404);
        sendJson(res, 200, { ok: true, removed: true, keyRemoved: result.keyRemoved });
      }
    });

  }
});
