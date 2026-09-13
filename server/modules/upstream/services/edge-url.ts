import { validateUpstreamUrl } from '../domain/ssrf.ts';

/** Worker DNS uses HTTPS, never a raw TCP socket or a user-selected resolver. */
export async function validateEdgeUrl(baseUrl: string, _allowedHosts: readonly string[]) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return { ok: false, reason: '云端只支持无用户信息的 HTTPS 上游地址（443 端口）' };
  } catch { return { ok: false, reason: '无效的上游地址' }; }
  const lookup = async (hostname: string) => {
    const answers = await Promise.all(['A', 'AAAA'].map(async type => {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) throw new Error('DNS unavailable');
      const data = await response.json() as { Status: number; Answer?: { type: number; data: string }[] };
      if (data.Status !== 0) throw new Error('DNS lookup failed');
      return (data.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => ({ address: a.data, family: a.type === 1 ? 4 : 6 }));
    }));
    const addresses = answers.flat();
    if (!addresses.length) throw new Error('DNS has no addresses');
    return addresses;
  };
  return validateUpstreamUrl(baseUrl, [], lookup);
}
