import sampleFeature, { NODE_2 } from './x.feature.js';

sampleFeature.setup(NODE_2, () => {
    return {
        nodeEnv2: {
            getPid: () => process.pid,
        },
    };
});
