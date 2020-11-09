import { nodeEnv } from '../feature/all.feature';
import parentFeature from './parent.feature';
globalThis.envMessages.push('parentEnvEval');

parentFeature.setup(nodeEnv, () => undefined);
