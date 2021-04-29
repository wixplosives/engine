import sampleFeature, { NODE_2 } from './x.feature';

sampleFeature.setup(NODE_2, () => {
    return {
        node_env_2: {
            getPid: () => process.pid,
        },
    };
});
