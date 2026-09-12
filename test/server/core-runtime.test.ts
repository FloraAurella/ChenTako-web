// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveModules, createModuleRuntime, type ModuleDefinition } from '../../server/core/modules.ts';
import { Registry } from '../../server/core/registry.ts';
import { Scope } from '../../server/core/scope.ts';
import { RouteRegistry } from '../../server/core/router.ts';

describe('模块运行时', () => {
  it('按 dependsOn 拓扑排序，重复/缺失/循环依赖分别报错', () => {
    const definition = (id: string, dependsOn: string[] = []): ModuleDefinition<unknown> => ({ id, dependsOn, setup() {} });
    expect(resolveModules([definition('a', ['b']), definition('b', ['c']), definition('c')]).map((m) => m.id))
      .toEqual(['c', 'b', 'a']);
    expect(() => resolveModules([definition('a'), definition('a')])).toThrow('Duplicate or empty module: a');
    expect(() => resolveModules([definition('a', ['ghost'])])).toThrow('Missing module dependency: ghost');
    expect(() => resolveModules([definition('a', ['b']), definition('b', ['a'])])).toThrow('Circular module dependency: a → b → a');
  });

  it('setup 失败时逆序回滚已启动模块的贡献，且事件监听被清空', () => {
    const events: string[] = [];
    const cleanupA = () => { events.push('cleanup-a'); };
    const modules: ModuleDefinition<{ routes: RouteRegistry }>[] = [
      { id: 'a', setup: ({ services }) => { services.routes.register('a', { id: 'r1', method: 'GET', pattern: '/api/a', handler: () => {} }); return cleanupA; } },
      { id: 'b', setup: () => { throw new Error('boom'); } }
    ];
    const runtime = createModuleRuntime(modules, { routes: new RouteRegistry() });
    expect(() => runtime.start()).toThrow('boom');
    expect(events).toEqual(['cleanup-a']);
  });

  it('dispose 可重复调用且聚合清理错误', () => {
    const order: string[] = [];
    const modules: ModuleDefinition<unknown>[] = [
      { id: 'a', setup: () => () => { order.push('a'); throw new Error('a-fail'); } },
      { id: 'b', setup: () => () => { order.push('b'); } }
    ];
    const runtime = createModuleRuntime(modules, {});
    runtime.start();
    // 清理失败被聚合抛出（与前端运行时同一语义），第二次 dispose 不再重复抛
    expect(() => runtime.dispose()).toThrow(AggregateError);
    expect(() => runtime.dispose()).not.toThrow();
    expect(order).toEqual(['b', 'a']);
  });
});

describe('有属主的注册表', () => {
  it('重复 id 拒绝注册，removeOwner 只清自己的贡献', () => {
    const registry = new Registry<{ id: string }>();
    registry.register('a', { id: 'x' });
    expect(() => registry.register('b', { id: 'x' })).toThrow('Duplicate or empty contribution: x');
    registry.register('b', { id: 'y' });
    registry.removeOwner('a');
    expect(registry.list().map((entry) => entry.id)).toEqual(['y']);
  });
});

describe('Node 作用域', () => {
  it('逆序释放、可重复释放，关闭后的 defer 立即执行', () => {
    const order: string[] = [];
    const scope = new Scope();
    scope.defer(() => order.push('first'));
    scope.defer(() => order.push('second'));
    scope.dispose();
    expect(() => scope.dispose()).not.toThrow();
    expect(order).toEqual(['second', 'first']);
    scope.defer(() => order.push('late'));
    expect(order).toContain('late');
  });

  it('跟随释放中止 AbortController，定时器在释放后不再触发', async () => {
    const scope = new Scope();
    const controller = new AbortController();
    scope.abort(controller);
    let timerFired = false;
    scope.timeout(() => { timerFired = true; }, 5);
    scope.dispose();
    expect(controller.signal.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(timerFired).toBe(false);
  });
});
