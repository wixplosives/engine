import nonContextualFeature from './non-contextual.feature';
import { procEnv } from './contextual.feature';

globalThis.envMessages = [...(globalThis.envMessages ?? []), 'procEnvContextualNoContextPreload'];
nonContextualFeature.setup(procEnv, () => undefined);
