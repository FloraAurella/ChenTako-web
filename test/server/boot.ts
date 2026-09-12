import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadServerConfig } from '../../server/app/config.ts';
import { createComposition } from '../../server/app/composition.ts';
import { serviceOf, type ServerConfig } from '../../server/contracts/contributions.ts';
import type { HttpGateway } from '../../server/modules/gateway/services/http-server.ts';

export interface TestServer {
  baseUrl: string;
  runtime: ReturnType<typeof createComposition>['runtime'];
  close: () => Promise<void>;
}

/** 以临时数据目录 + 临时端口启动真实组合后的后端；fetch 直接打 HTTP 层。 */
export async function bootTestServer(overrides: Partial<ServerConfig> = {}): Promise<TestServer> {
  const dataDir = mkdtempSync(join(tmpdir(), 'clawbox-server-test-'));
  const config: ServerConfig = {
    ...loadServerConfig(dataDir),
    port: 0,
    ...overrides,
    dataDir
  };
  const { runtime, contributions } = createComposition(config);
  runtime.start();
  const gateway = serviceOf<HttpGateway>(contributions.services, 'http-server');
  await gateway.listen(0, '127.0.0.1');
  const address = gateway.address();
  if (!address) throw new Error('测试服务器未监听');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    runtime,
    close: () => new Promise((resolve) => { runtime.dispose(); resolve(); })
  };
}
