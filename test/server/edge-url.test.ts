// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateEdgeUrl } from '../../server/modules/upstream/public/edge.ts';

describe('Cloud Worker upstream URL policy', () => {
  it('accepts public domains without a DNS preflight', async () => {
    await expect(validateEdgeUrl('https://api.commandcode.ai/provider/v1', [])).resolves.toMatchObject({ ok: true });
  });

  it('keeps protocol and obvious private-host protections', async () => {
    await expect(validateEdgeUrl('http://api.commandcode.ai/v1', [])).resolves.toMatchObject({ ok: false });
    await expect(validateEdgeUrl('https://127.0.0.1/v1', [])).resolves.toMatchObject({ ok: false });
    await expect(validateEdgeUrl('https://localhost/v1', [])).resolves.toMatchObject({ ok: false });
  });
});
