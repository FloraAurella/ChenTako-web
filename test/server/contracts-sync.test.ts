// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LIMITS as FRONTEND_LIMITS, RESPONSE_FORMATS as FRONTEND_FORMATS, EFFORT_LEVELS as FRONTEND_EFFORTS } from '../../src/contracts/constants.js';
import { APP_STREAM_EVENTS as FRONTEND_EVENTS, APP_STREAM_VERSION as FRONTEND_VERSION } from '../../src/modules/chat/stream/protocol.ts';
import { LIMITS, RESPONSE_FORMATS, EFFORT_KEYS } from '../../server/contracts/limits.ts';
import { APP_STREAM_EVENTS, APP_STREAM_VERSION } from '../../server/contracts/protocol.ts';

/**
 * 防漂移契约：后端常量必须与前端权威定义逐字一致。
 * 任何一侧单独改动都会在这里红测，强制两侧同步。
 */
describe('前后端契约同步', () => {
  it('LIMITS 与 src/contracts/constants.js 完全一致', () => {
    expect(LIMITS).toEqual(FRONTEND_LIMITS);
  });

  it('应用层流协议事件名与版本与前端解码端一致', () => {
    expect(APP_STREAM_VERSION).toBe(FRONTEND_VERSION);
    expect(APP_STREAM_EVENTS).toEqual(FRONTEND_EVENTS);
  });

  it('四协议键与前端 RESPONSE_FORMATS 一致', () => {
    expect([...RESPONSE_FORMATS]).toEqual(FRONTEND_FORMATS.map((entry: { key: string }) => entry.key));
  });

  it('思考强度档位与前端 EFFORT_LEVELS 一致', () => {
    expect(EFFORT_KEYS.filter((key) => key !== 'none')).toEqual(FRONTEND_EFFORTS.map((entry: { key: string }) => entry.key));
  });
});
