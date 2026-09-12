import type { BackendModule } from '../../contracts/contributions.ts';
import { serviceOf } from '../../contracts/contributions.ts';
import type { RouteContribution } from '../../core/router.ts';
import type { ProviderStore } from '../providers/public/services_store.ts';
import type { UpstreamService } from '../upstream/public/module.ts';
import { handleChat, handleCompress, type ChatDeps } from './services/chat-routes.ts';

/**
 * chat：/api/chat 与 /api/chat/compress 的编排。
 * 校验 → 注册表匹配 → Key 解析 → 上游构造 → SSE v1 投影，全部经
 * providers / upstream 的公开服务完成，本模块不直接触碰存储细节。
 */
export const module: BackendModule = {
  id: 'chat',
  dependsOn: ['gateway', 'providers', 'upstream'],
  setup({ services, scope }) {
    const deps: ChatDeps = {
      store: serviceOf<ProviderStore>(services.services, 'providers.store'),
      upstream: serviceOf<UpstreamService>(services.services, 'upstream'),
      ssrfAllow: services.config.ssrfAllow,
      bodyLimit: services.config.bodyLimitBytes
    };
    const register = (route: RouteContribution) => { scope.defer(services.routes.register('chat', route)); };
    register({
      id: 'chat-stream',
      method: 'POST',
      pattern: '/api/chat',
      handler: (context) => handleChat(deps, context)
    });
    register({
      id: 'chat-compress',
      method: 'POST',
      pattern: '/api/chat/compress',
      handler: (context) => handleCompress(deps, context)
    });
  }
};
