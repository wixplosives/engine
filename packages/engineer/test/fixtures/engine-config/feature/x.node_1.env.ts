import sampleFeature, { NODE_1 } from './x.feature';

sampleFeature.setup(NODE_1, () => {
    return {
        node_env_1: {
            getPid: () => process.pid,
        },
    };
});
