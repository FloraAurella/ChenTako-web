import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * SSRF 防护（原版 lib/upstream.ts 移植）：默认阻断 localhost/内网/链路本地地址，
 * 防止后端被当作跳板。允许列表由应用配置传入（AI_CHATBOX_SSRF_ALLOW）。
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (net.isIP(ip) === 0) return false;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 100 && Number(parts[1]) >= 64 && Number(parts[1]) <= 127) ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && Number(parts[1]) >= 16 && Number(parts[1]) <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0 ||
      Number(parts[0]) >= 224
    );
  }
  const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/i.exec(ip);
  if (mapped) {
    const high = parseInt(mapped[1]!, 16); const low = parseInt(mapped[2]!, 16);
    return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  if (ip.startsWith('::ffff:') && ip.includes('.')) return isPrivateAddress(ip.slice(7));
  return /^::1$/.test(ip) ||
    /^fe[89ab]/i.test(ip) ||
    /^f[cd]/i.test(ip) ||
    /^ff/i.test(ip) ||
    /^::$/.test(ip) ||
    /^2001:db8:/i.test(ip);
}

export async function validateUpstreamUrl(baseUrl: string, allowedHosts: readonly string[], lookup: (hostname: string, options: { all: true }) => Promise<{ address: string }[]> = dns.lookup): Promise<{ ok: boolean; reason?: string }> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, reason: 'Base URL 不是合法的 URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Base URL 只允许 http/https' };
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) return { ok: false, reason: 'Base URL 缺少主机名' };
  if (allowedHosts.includes(hostname)) return { ok: true };

  if (/^(localhost|.*\.local|.*\.internal)$/.test(hostname)) {
    return { ok: false, reason: `不允许访问内部主机 ${hostname}（如需本地调试请配置 AI_CHATBOX_SSRF_ALLOW）` };
  }
  if (net.isIP(hostname) !== 0) {
    if (isPrivateAddress(hostname)) {
      return { ok: false, reason: `不允许访问内网地址 ${hostname}（如需本地调试请配置 AI_CHATBOX_SSRF_ALLOW）` };
    }
    return { ok: true };
  }
  // 域名：解析后检查所有地址，任何一个命中私网都拦截
  try {
    const result = await lookup(hostname, { all: true });
    const addresses = Array.isArray(result) ? result.map((item) => item.address) : [String(result)];
    if (addresses.some((address) => isPrivateAddress(address))) {
      return { ok: false, reason: `域名 ${hostname} 解析到内网地址，已阻止` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: `无法解析主机 ${hostname}` };
  }
}

/** 宽松回环判断：回环上游允许无 Key（本地 mock/自建服务）。 */
export function isLoopbackBaseUrl(baseUrl: unknown): boolean {
  try {
    const hostname = new URL(String(baseUrl)).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
  } catch {
    return false;
  }
}
