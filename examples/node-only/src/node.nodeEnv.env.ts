import nodeFeature, { NodeEnv } from './node.feature.js';

nodeFeature.setup(NodeEnv, () => {
    console.log('I am a node env only application');
});
