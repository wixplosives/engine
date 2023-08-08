import contextualFeature, { procEnv } from './preload-context.feature.js';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'nodeEnvCtxEval'];

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
