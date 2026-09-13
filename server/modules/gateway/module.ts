import type { BackendContributions, BackendModule } from '../../contracts/contributions.ts';
import { sendJson } from '../../core/router.ts';
import { HttpGateway } from './services/http-server.ts';

/**
 * gateway：HTTP 传输与安全边界（监听、Origin/令牌校验、路由分发、错误处理），
 * 不含任何业务规则。health 属于传输层探活——前端以 ok:true 区分
 * 「后端未启动」与代理回退假 200，因此免启动令牌。
 */
export const module: BackendModule = {
  id: 'gateway',
  dependsOn: [],
  setup({ services, scope }) {
    const gateway = new HttpGateway(services.routes, {
      host: services.config.host,
      port: services.config.port,
      apiToken: services.config.apiToken,
      corsOrigins: services.config.corsOrigins,
      allowNullOrigin: services.config.allowNullOrigin
    });
    scope.defer(() => { void gateway.close(); });
    services.services.register('gateway', { id: 'http-server', value: gateway });
    services.routes.register('gateway', {
      id: 'health',
      method: 'GET',
      pattern: '/api/health',
      handler: ({ res }) => { sendJson(res, 200, { ok: true, service: 'ChenTako-server' }); }
    });
    return () => services.services.removeOwner('gateway');
  }
};
