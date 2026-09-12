import { loadServerConfig } from './config.ts';
import { createComposition } from './composition.ts';
import { serviceOf, type HttpServerService } from '../contracts/contributions.ts';

const serverRoot = import.meta.dirname ? `${import.meta.dirname}/..` : new URL('..', import.meta.url).pathname;
const config = loadServerConfig(serverRoot);
const { runtime, contributions } = createComposition(config);

runtime.start();

const gateway = serviceOf<HttpServerService>(contributions.services, 'http-server');
await gateway.listen(config.port, config.host);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try { runtime.dispose(); } catch (error) { console.error('[main] 关闭失败', error); process.exitCode = 1; }
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void shutdown(); });
