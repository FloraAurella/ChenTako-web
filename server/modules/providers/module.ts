import { createProvidersModule } from './routes.ts';
import { ProviderStore } from './services/store.ts';
export const module = createProvidersModule(services => new ProviderStore(services.config.dataDir));
