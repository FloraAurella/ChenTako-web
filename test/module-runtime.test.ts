import {describe,it,expect,vi} from 'vitest';
import {createModuleRuntime,resolveModules, type ModuleDefinition} from '../src/core/modules';
import {Registry} from '../src/core/registry';
import {Scope} from '../src/core/scope';
import {createResourceRegistry} from '../src/resources/registry.js';
import {createComposition} from '../src/app/composition';
import {parseRoute} from '../src/app/router.js';

describe('module ownership and composition',()=>{
 it('orders dependencies and removes contributions in reverse on dispose',()=>{
  const registry = new Registry<{id:string}>(); const calls:string[]=[];
  const modules:ModuleDefinition<typeof registry>[] = [
   {id:'feature',dependsOn:['base'],setup({scope,services}) {calls.push('feature');scope.defer(services.register('feature',{id:'pane'}));return ()=>{calls.push('-feature');};}},
   {id:'base',setup(){calls.push('base');return ()=>{calls.push('-base');};}},
  ];
  const runtime=createModuleRuntime(modules,registry);runtime.start();runtime.start();
  expect(calls).toEqual(['base','feature']);expect(registry.list()).toHaveLength(1);
  runtime.dispose();runtime.dispose();expect(calls).toEqual(['base','feature','-feature','-base']);expect(registry.list()).toEqual([]);
 });
 it('rejects missing, duplicate and cyclic dependencies',()=>{
  const setup=()=>{};
  expect(()=>resolveModules([{id:'a',dependsOn:['b'],setup}])).toThrow('Missing');
  expect(()=>resolveModules([{id:'a',setup},{id:'a',setup}])).toThrow('Duplicate');
  expect(()=>resolveModules([{id:'a',dependsOn:['b'],setup},{id:'b',dependsOn:['a'],setup}])).toThrow('Circular');
 });
 it('rolls back even the failing module and allows retry',()=>{
  const registry=new Registry<{id:string}>();let fail=true;
  const runtime=createModuleRuntime([{id:'a',setup({scope}){scope.defer(registry.register('a',{id:'a'}));if(fail) throw Error('failure');}}],{});
  expect(()=>runtime.start()).toThrow('failure');expect(registry.list()).toEqual([]);
  fail=false;runtime.start();expect(registry.list()).toHaveLength(1);runtime.dispose();
 });
 it('removes listeners and pending timers on disposal',()=>{
  vi.useFakeTimers();const scope=new Scope();const target=new EventTarget();const callback=vi.fn();
  scope.listen(target,'change',callback);scope.timeout(callback,20);target.dispatchEvent(new Event('change'));scope.dispose();
  target.dispatchEvent(new Event('change'));vi.runAllTimers();expect(callback).toHaveBeenCalledTimes(1);vi.useRealTimers();
 });
 it('omits optional panes, domains and search; route falls back to an installed pane',()=>{
  const composition=createComposition(['extensions','data']);const c=composition.contributions;
  expect(c.settings.list().map(p=>p.id)).toEqual(['appearance','providers','context','knowledge']);
  expect(c.domains.get('extensions')).toBeUndefined();expect(c.controllers.get('chat')).toBeDefined();
  expect(c.slots.get('projects.selector')).toBeDefined();
  expect(parseRoute('#/settings/tools','tools',c.settings.list().map(p=>p.id)).settingsSection).toBe('providers');
  composition.dispose();expect(c.settings.list()).toEqual([]);expect(c.slots.list()).toEqual([]);
  expect(()=>createComposition(['connections'])).toThrow('Required');
 });
});

describe('layered resources',()=>{
 it('resolves user > module > system and restores previous value after unregister',()=>{
  const r=createResourceRegistry();r.register({id:'theme/example',owner:'base',layer:'system',value:'base'});
  const removeModule=r.register({id:'theme/example',owner:'feature',layer:'module',value:'module'});
  const removeUser=r.register({id:'theme/example',owner:'user',layer:'user',value:'user'});
  expect(r.resolve('theme/example')).toBe('user');removeUser();expect(r.resolve('theme/example')).toBe('module');removeModule();expect(r.resolve('theme/example')).toBe('base');
 });
 it('rejects duplicate ownership and unvalidated executable user icon entries',()=>{
  const r=createResourceRegistry();r.register({id:'icon/test',owner:'feature',value:'trusted'});
  expect(()=>r.register({id:'icon/test',owner:'feature',value:'duplicate'})).toThrow('Duplicate');
  expect(()=>r.register({id:'icon/test',owner:'user',layer:'user',value:'<script/>'})).toThrow('User resources');
  r.removeOwner('feature');expect(r.resolve('icon/test','fallback')).toBe('fallback');
 });
});
