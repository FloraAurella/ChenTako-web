import type { BackendModule } from '../../../contracts/contributions.ts';
import { sendJson } from '../../../core/router.ts';
export const edgeGateway: BackendModule = {
  id: 'gateway', dependsOn: [], setup({ services, scope }) {
    scope.defer(services.routes.register('gateway', { id: 'health', method: 'GET', pattern: '/api/health', handler: ({ res }) => sendJson(res, 200, { ok: true, service: 'ChenTako-cloud', storage: 'isolated' }) }));
  }
};
export function edgeCors(request: Request, origins: string): Record<string, string> | null {
  const origin = request.headers.get('origin');
  if (origin && !origins.split(',').map(v => v.trim()).includes(origin)) return null;
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    Vary: 'Origin', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-chentako-vault',
    'Access-Control-Max-Age': '600'
  };
}
export async function tenantDigest(request: Request): Promise<string | null> {
  const token = request.headers.get('x-chentako-vault') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
