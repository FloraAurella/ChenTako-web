import type { ModuleDefinition } from '../core/modules.ts';
import type { RouteRegistry } from '../core/router.ts';
import type { Registry } from '../core/registry.ts';

/** 应用装配注入的运行配置；模块只读，不允许 import app 自己解析环境。 */
export interface ServerConfig {
  host: string;
  port: number;
  apiToken: string;
  corsOrigins: string[];
  allowNullOrigin: boolean;
  dataDir: string;
  ssrfAllow: string[];
  bodyLimitBytes: number;
  disabledModules: string[];
}

/** gateway 注册的 HTTP 服务句柄；main/测试经服务注册表获取，不导入模块内部。 */
export interface HttpServerService {
  listen(port?: number, host?: string): Promise<void>;
  address(): { address: string; port: number } | null;
}

/** 业务模块注册进服务注册表的能力句柄（如 providers 存储、upstream 适配器）。 */
export interface ServiceContribution {
  id: string;
  value: unknown;
}

/** 后端贡献包：与前端 FrontendContributions 同构——模块只通过注册表与只读配置交互。 */
export interface BackendContributions {
  config: ServerConfig;
  routes: RouteRegistry;
  services: Registry<ServiceContribution>;
}

export type BackendModule = ModuleDefinition<BackendContributions>;

/** 按约定从服务注册表取能力；类型断言集中在这一处。 */
export function serviceOf<T>(services: Registry<ServiceContribution>, id: string): T {
  const contribution = services.get(id);
  if (!contribution) throw new Error(`服务未注册: ${id}`);
  return contribution.value as T;
}
