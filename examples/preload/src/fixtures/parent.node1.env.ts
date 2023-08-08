import { nodeEnv } from '../feature/all.feature.js';
import parentFeature from './parent.feature.js';
globalThis.envMessages.push('parentEnvEval');

parentFeature.setup(nodeEnv, () => undefined);
