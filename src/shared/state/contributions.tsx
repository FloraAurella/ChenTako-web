import { createContext, useContext, type ReactNode } from 'react';
import type { FrontendContributions } from '../../contracts/contributions';

const ContributionsContext = createContext<FrontendContributions | null>(null);
export function ContributionsProvider({ value, children }: { value: FrontendContributions; children: ReactNode }) {
  return <ContributionsContext.Provider value={value}>{children}</ContributionsContext.Provider>;
}
export function useContributions() {
  const context = useContext(ContributionsContext);
  if (!context) throw new Error('ContributionsProvider is required');
  return context;
}
export function ExtensionSlot({ name, store, projectId }: { name: 'composer.before' | 'composer.actions' | 'project.settings'; store: any; projectId?: string }) {
  const { slots } = useContributions();
  return <>{slots.list().filter(entry => entry.slot === name).map(entry => { const Component = entry.component; return <Component key={entry.id} store={store} projectId={projectId} />; })}</>;
}
