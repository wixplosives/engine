import contextualFeature, { procEnv } from './preload-context.feature.js';
globalThis.envMessages = [...(globalThis.envMessages ?? []), 'workerEnvCtxEval'];

contextualFeature.setupContext(procEnv, 'someCtx', () => ({}));
