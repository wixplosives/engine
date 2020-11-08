globalThis.envMessages.push('parentEnvEval');
import { nodeEnv } from '../feature/all.feature';
import parentFeature from './parent.feature';

parentFeature.setup(nodeEnv, () => {});
