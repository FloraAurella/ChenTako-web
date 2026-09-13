import net from 'node:net';
import { isPrivateAddress } from '../domain/ssrf.ts';

/**
 * Cloud Worker 地址校验不主动查询公网域名 DNS。
 * Worker 会在真正 fetch 上游时解析域名；这里仍拦截明显的本机／内网目标，
 * 保留 HTTPS、端口和凭据校验，避免 DNS 服务短暂故障误伤正常供应商。
 */
export async function validateEdgeUrl(baseUrl: string, _allowedHosts: readonly string[]) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
      return { ok: false, reason: '云端只支持无用户信息的 HTTPS 上游地址（443 端口）' };
    }
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!hostname) return { ok: false, reason: '上游地址缺少主机名' };
    if (/^(localhost|.*\.local|.*\.internal)$/.test(hostname)) {
      return { ok: false, reason: `不允许访问内部主机 ${hostname}` };
    }
    if (net.isIP(hostname) !== 0 && isPrivateAddress(hostname)) {
      return { ok: false, reason: `不允许访问内网地址 ${hostname}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: '无效的上游地址' };
  }
}
